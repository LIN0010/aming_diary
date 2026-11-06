# 瑞穗自由手帳編輯（第二階段最小版本）

- 原有 StPageFlip 2.0.7 不變；新增 Fabric.js 5.3.0 瀏覽器版，MIT 授權及原文見 THIRD_PARTY_LICENSES.md / aming-game/vendor/fabric/LICENSE。
- 入口：解鎖瑞穗記憶 → 瑞穗跨頁 → 編輯手帳。Fabric 只操作左頁的玩家拍立得、照片和個人貼紙；右頁故事、心得、收藏碎片仍是原 HTML。
- 玩家照片及拍立得一起移動／旋轉／縮放；保留上傳照片。刪除工具只刪除自行加入的貼紙。
- 貼紙暫用專案既有的 images/guild-compass.png、images/guild-journal.png；尚未加入專用紙膠帶素材，不生成額外圖片。
- 原生 Fabric 控制點可縮放與旋轉；工具列另有旋轉、放大、縮小，方便觸控。拖曳不影響翻頁引擎的建立次數。

## 讀寫與預設

沿用本機 localStorage，新增獨立鍵 `aming-diary-journal-layouts`：

```js
{
  version: 1,
  stations: {
    ruisui: {
      stationId: 'ruisui',
      photo: 'data:image/jpeg;base64,...',
      objects: [
        { id: 'player-polaroid', type: 'photo', source: 'player-photo',
          x: 0.65, y: 0.78, scale: 1, angle: 3, order: 0 },
        { id: 'unique-id', type: 'sticker', source: 'compass',
          x: 0.4, y: 0.55, scale: 1, angle: -8, order: 1 }
      ]
    }
  }
}
```

座標以 600×800 邏輯單頁計算後正規化，縮放不使用螢幕像素。source 由素材表解析，不接受任意遠端 URL。照片選取後真正繪製為最長邊 1200px、品質 .82 的 JPEG，再存 Data URL；暫時性 Object URL 只用於解碼，立即釋放，不寫入存檔。現有其他站點／版本資料不會因保存瑞穗而移除。

官方預設來自原 HTML 拍立得的相對位置及獨立預設模板，玩家修改不回寫模板。「恢復預設排版」只重建照片框及清除個人貼紙，保留照片、心得、解鎖資料。完成編輯、闔書、離開場景及 pagehide 時保存；若寫入失敗，保留草稿，阻止完成／離開並提供重試提示。正在解碼圖片時也阻止完成與換場。

「開始遊戲」沿用 GameProgress.reset 的 `aming-diary-` 命名空間清除，包含此新鍵；繼續旅程不清除。無跨裝置或雲端同步，每個瀏覽器使用既有的單一本機玩家進度。儲存容量不足時不清除舊存檔。

## StPageFlip 相容層

Fabric 編輯層位於瑞穗左頁 DOM 內；編輯時只在此層放行 Fabric 起拖事件，並在層內停止冒泡，其他 HTML 文字輸入仍保留。閱讀時只有該裝飾層不接收指標事件，整頁仍交給原生翻頁。

StPageFlip 的臨時頁會 cloneNode，Canvas bitmap 不會被複製。因此閱讀模式將 Fabric 畫面輸出成同頁內的透明 PNG img（不另外持久化），翻頁複本可原生複製；再次編輯仍使用同一個 Fabric 實例和原物件。沒有更改套件的 transform、clip-path 或翻頁幾何，也沒有把整張日記變成 Canvas。

ResizeObserver 只同步 Fabric 顯示尺寸；單頁邏輯尺寸不變。Fabric 5 的 cssOnly API 需使用有 px 單位的尺寸字串，避免手機畫布保留 600px 寬度。SPA 清理時移除觀察器、事件、畫布與工具列。

## 驗證

執行 `python tests/journal-layout.browser.py`、`python tests/diary-mode.browser.py` 及 `python tests/diary-photo-text.browser.py`。測試使用本機 Chromium、真實滑鼠／CDP 觸控事件及手機橫向 viewport 模擬；不是 iPhone Safari 實機測試。

尚未擴充其他站點、右頁裝飾、多張玩家照片、貼紙素材上傳、圖層調整工具、雲端保存或多指手勢；本階段僅提供單一選取物件的拖曳與控制點操作。復原記錄限本次頁面操作，最多 30 步，不跨重新整理。
