package v1

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/labstack/echo/v5"

	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

const (
	neteasePresetKey = "0CoJUm6Qyw8W8jud"
	neteaseIv        = "0102030405060708"
	neteaseModulus   = "00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7"
	neteaseExponent  = "010001"
)

// pkcs7Padding pads data to aes block size.
func pkcs7Padding(src []byte, blockSize int) []byte {
	padding := blockSize - len(src)%blockSize
	padtext := bytes.Repeat([]byte{byte(padding)}, padding)
	return append(src, padtext...)
}

// aesEncrypt encrypts content using AES-128-CBC.
func aesEncrypt(text []byte, key []byte, iv []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	padded := pkcs7Padding(text, block.BlockSize())
	blockMode := cipher.NewCBCEncrypter(block, iv)
	encrypted := make([]byte, len(padded))
	blockMode.CryptBlocks(encrypted, padded)
	return base64.StdEncoding.EncodeToString(encrypted), nil
}

// rsaEncrypt performs plain raw RSA encryption with reversed bytes.
func rsaEncrypt(text []byte, modulusHex string, exponentHex string) (string, error) {
	reversed := make([]byte, len(text))
	for i, b := range text {
		reversed[len(text)-1-i] = b
	}

	nBytes, err := hex.DecodeString(modulusHex)
	if err != nil {
		return "", err
	}
	eBytes, err := hex.DecodeString(exponentHex)
	if err != nil {
		return "", err
	}

	n := new(big.Int).SetBytes(nBytes)
	e := new(big.Int).SetBytes(eBytes)

	m := new(big.Int).SetBytes(reversed)
	c := new(big.Int).Exp(m, e, n)

	return fmt.Sprintf("%0256x", c), nil
}

// encryptWeapi signs parameters with NetEase Weapi AES+RSA encryption.
func encryptWeapi(text []byte) (string, string, error) {
	// Generate random 16-character key
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	secKey := make([]byte, 16)
	for i := range secKey {
		secKey[i] = letters[r.Intn(len(letters))]
	}

	// 1. Encrypt text with preset key
	params, err := aesEncrypt(text, []byte(neteasePresetKey), []byte(neteaseIv))
	if err != nil {
		return "", "", err
	}

	// 2. Encrypt params with the random secKey
	params, err = aesEncrypt([]byte(params), secKey, []byte(neteaseIv))
	if err != nil {
		return "", "", err
	}

	// 3. Encrypt secKey with RSA public key
	encSecKey, err := rsaEncrypt(secKey, neteaseModulus, neteaseExponent)
	if err != nil {
		return "", "", err
	}

	return params, encSecKey, nil
}

// neteasePost sends encrypted request to NetEase Cloud Music server.
func neteasePost(endpoint string, jsonPayload string, cookie string) ([]byte, []string, error) {
	params, encSecKey, err := encryptWeapi([]byte(jsonPayload))
	if err != nil {
		return nil, nil, err
	}

	form := url.Values{}
	form.Set("params", params)
	form.Set("encSecKey", encSecKey)

	req, err := http.NewRequest("POST", "https://music.163.com"+endpoint+"?csrf_token=", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, nil, err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Referer", "https://music.163.com")
	req.Header.Set("Origin", "https://music.163.com")
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	} else {
		req.Header.Set("Cookie", "os=pc; appver=2.9.7;")
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, err
	}

	var cookies []string
	for _, c := range resp.Cookies() {
		cookies = append(cookies, fmt.Sprintf("%s=%s", c.Name, c.Value))
	}

	return body, cookies, nil
}

// RegisterNeteaseRoutes registers NetEase proxy endpoints.
func RegisterNeteaseRoutes(router *echo.Group, storeInstance *store.Store, secret string) {
	authenticator := auth.NewAuthenticator(storeInstance, secret)

	authMiddleware := func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			result := authenticator.Authenticate(c.Request().Context(), authHeader)
			if result == nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
			}
			ctx := auth.ApplyToContext(c.Request().Context(), result)
			c.SetRequest(c.Request().WithContext(ctx))
			return next(c)
		}
	}

	// Subgroup under /api/v1/netease
	g := router.Group("/api/v1/netease", authMiddleware)

	// 1. Get QR code key
	g.GET("/qr/key", func(c *echo.Context) error {
		body, _, err := neteasePost("/weapi/login/qrcode/unikey", `{"type":1}`, "")
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return c.Blob(http.StatusOK, "application/json", body)
	})

	// 2. Check QR code scan status
	g.GET("/qr/check", func(c *echo.Context) error {
		key := c.QueryParam("key")
		if key == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "key is required"})
		}
		payload := fmt.Sprintf(`{"key":"%s","type":1}`, key)
		body, cookies, err := neteasePost("/weapi/login/qrcode/client/login", payload, "")
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		// Parse response to see if login succeeded
		var result map[string]interface{}
		if err := json.Unmarshal(body, &result); err == nil {
			if codeVal, ok := result["code"].(float64); ok && codeVal == 803 {
				// Inject the extracted cookies into the response so frontend can persist it
				cookieStr := strings.Join(cookies, "; ")
				result["cookie"] = cookieStr
				newBody, err := json.Marshal(result)
				if err == nil {
					body = newBody
				}

				// Save NetEase cookie to Memos user data directory
				userID := auth.GetUserID(c.Request().Context())
				if userID != 0 {
					cookiePath := filepath.Join(storeInstance.GetDataDir(), fmt.Sprintf("netease_cookie_%d.txt", userID))
					_ = os.WriteFile(cookiePath, []byte(cookieStr), 0600)
				}
			}
		}

		return c.Blob(http.StatusOK, "application/json", body)
	})

	// 3. Get user playlists
	g.GET("/user/playlists", func(c *echo.Context) error {
		cookie := c.QueryParam("cookie")
		if cookie == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "cookie is required"})
		}

		// First call /weapi/nuser/account/get to get user ID
		accountBody, _, err := neteasePost("/weapi/nuser/account/get", "{}", cookie)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		var accountResult map[string]interface{}
		if err := json.Unmarshal(accountBody, &accountResult); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to parse account info"})
		}

		profileVal, exists := accountResult["profile"]
		if !exists || profileVal == nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "not logged in or invalid cookie"})
		}

		profileMap, ok := profileVal.(map[string]interface{})
		if !ok {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "invalid profile format"})
		}

		userIDVal, exists := profileMap["userId"]
		if !exists {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "userId not found in profile"})
		}

		userIDFloat, ok := userIDVal.(float64)
		if !ok {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "invalid userId format"})
		}
		userID := int64(userIDFloat)

		// Second call /weapi/user/playlist to get playlists of user
		playlistPayload := fmt.Sprintf(`{"uid":%d,"limit":1000,"offset":0}`, userID)
		body, _, err := neteasePost("/weapi/user/playlist", playlistPayload, cookie)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return c.Blob(http.StatusOK, "application/json", body)
	})

	// 4. Get playlist tracks
	g.GET("/playlist/tracks", func(c *echo.Context) error {
		playlistID := c.QueryParam("playlist_id")
		cookie := c.QueryParam("cookie")
		if playlistID == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "playlist_id is required"})
		}
		if cookie == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "cookie is required"})
		}

		payload := fmt.Sprintf(`{"id":"%s","n":1000,"s":8}`, playlistID)
		body, _, err := neteasePost("/weapi/v6/playlist/detail", payload, cookie)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return c.Blob(http.StatusOK, "application/json", body)
	})

	// 5. Get playable audio URL
	g.GET("/song/url", func(c *echo.Context) error {
		songID := c.QueryParam("song_id")
		cookie := c.QueryParam("cookie")
		if songID == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "song_id is required"})
		}
		if cookie == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "cookie is required"})
		}

		payload := fmt.Sprintf(`{"ids":"[%s]","level":"standard","encodeType":"mp3"}`, songID)
		body, _, err := neteasePost("/weapi/song/enhance/player/url/v1", payload, cookie)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return c.Blob(http.StatusOK, "application/json", body)
	})

	// 6. Get stored cookie
	g.GET("/cookie", func(c *echo.Context) error {
		userID := auth.GetUserID(c.Request().Context())
		if userID == 0 {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		}

		cookiePath := filepath.Join(storeInstance.GetDataDir(), fmt.Sprintf("netease_cookie_%d.txt", userID))
		cookieBytes, err := os.ReadFile(cookiePath)
		if err != nil {
			return c.JSON(http.StatusOK, map[string]string{"cookie": ""})
		}

		return c.JSON(http.StatusOK, map[string]string{"cookie": string(cookieBytes)})
	})

	// 7. Logout / delete stored cookie
	g.POST("/logout", func(c *echo.Context) error {
		userID := auth.GetUserID(c.Request().Context())
		if userID == 0 {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		}

		cookiePath := filepath.Join(storeInstance.GetDataDir(), fmt.Sprintf("netease_cookie_%d.txt", userID))
		_ = os.Remove(cookiePath)
		return c.JSON(http.StatusOK, map[string]string{"status": "success"})
	})
}
