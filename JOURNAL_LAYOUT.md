# 瑞穗自由手帳編輯（第二階段最小版本）

- 原有 StPageFlip 2.0.7 不變；新增 Fabric.js 5.3.0 瀏覽器版，MIT 授權及原文見 THIRD_PARTY_LICENSES.md / aming-game/vendor/fabric/LICENSE。
- 入口：解鎖瑞穗記憶 → 瑞穗跨頁 → 編輯手帳。Fabric 操作玩家拍立得、照片和個人貼紙；新增 DOM 群組編輯器操作探索拍立得、故事、心得及收藏碎片，所有敘事文字保留 HTML。
- 玩家照片及拍立得一起移動／旋轉／縮放；保留上傳照片。刪除工具只刪除自行加入的貼紙。
- 貼紙使用專案既有的 images/guild-compass.png、images/guild-journal.png；紙膠帶重用現有半透明紙膠帶色塊樣式，以向量矩形呈現，不新增插畫素材。
- 原生 Fabric 控制點可縮放與旋轉，直接點選拖曳，不需切換選取工具。右側方形圖示列整合闔書、編輯、照片、貼紙選單、刪除、復原與恢復預設；窄視窗移至書本上方留白並可收合。恢復預設需先確認；刪除只對個人貼紙啟用。拖曳不影響翻頁引擎的建立次數。

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

尚未擴充其他站點、多張玩家照片、貼紙素材上傳、圖層調整工具、雲端保存或多指手勢；本階段僅提供單一選取物件的拖曳與控制點操作。復原記錄限本次頁面操作，最多 30 步，不跨重新整理。

## HTML 主要內容群組擴充

`journal-dom-layout.js` 管理四個保留原節點的 HTML 群組：aming-photo（照片、相框、說明）、memory-fragment（圖片及標籤）、aming-story（完整章節／故事）、player-writing（完整標題／心得／既有保存控制）。同一車站存檔新增 `domObjects` 陣列；每筆包含 id、page、type=html、x/y、width、angle、order。舊存檔沒有此欄位時使用原 HTML 的位置，不重設照片或進度。

HTML 文字以寬度重排，維持字級，內容自然增高；極長內容可在區塊內捲動。手機的心得原位於右頁較下方，因此保留右頁內部捲動，不把內容擠回上方；書本外層不捲動。圖片群組維持比例；控制點支援拖曳及鍵盤方向鍵。選取時暫時置前只影響操作，不回寫已儲存圖層。

DOM 與 Fabric 共用復原及恢復預設；不得刪除官方群組。閱讀時清除選取框，收藏碎片保留滑鼠／鍵盤開啟既有碎片匣。玩家相片說明使用跟隨 Fabric 位置的 HTML 標籤。鎖定記憶時獨立群組也會隱藏，避免移出原容器後洩漏內容。

新增驗證：`python tests/journal-dom.browser.py`（桌面 1440×900／觸控橫向 852×393）：四群組選取、移動、調整寬度、旋轉、完整文字、心得保存、收藏操作、閱讀拖曳翻頁、重新整理、恢復預設與尺寸變化。仍未做 iPhone Safari 實機驗證。

## Fabric 統一操作：第一階段（乳牛拍立得）

探索乳牛拍立得改為真正 Fabric Group（原照片、紙框、膠帶、說明），與玩家拍立得共用選取、移動、縮放及旋轉處理。該物件不再建立 HTML 編輯框。新增 `official-photo` 類型及 aspect 欄位；舊 domObjects 的 aming-photo 可轉換為 Fabric 相對位置、角度、大小，不清除玩家照片與其他 HTML 群組排版。官方群組不能刪除，恢復預設會保留其原始樣式。

工具列顯示圖示及繁體中文名稱；窄視窗仍可收合。此為分階段交付：回憶碎片／故事／心得目前仍使用原 DOM 控制，跨頁拖移與重疊面積吸附尚未加入。不能把本階段視為整套統一互動或跨頁功能已完成。

測試：`tests/journal-cow-fabric.browser.py`（桌面／橫向觸控，兩組原生控制點與保存）；玩家照片中央上傳及更換另由 `tests/journal-photo-click.browser.py` 回歸驗證。

## 回憶碎片原生 Fabric 群組階段

新增 `journal-memory.js`：右頁乳牛奶盒與原標籤使用真正 Fabric.Group、原生八點縮放及旋轉控制桿，移除該物件的 DOM 編輯外框。原圖片、標籤與收藏事件節點保留；閱讀時使用同頁透明投影與可聚焦的點擊入口呼叫既有收藏匣。只裁切右頁 Fabric 互動畫布的命中範圍，避免透明區攔截故事與心得；不改 StPageFlip 幾何。

同一份車站存檔新增 `memoryObject`，包含 id/type/source/page/x/y/scale/angle/order，座標相對單頁 600×800。讀取舊 domObjects 的 memory-fragment 時轉換位置、寬度與角度，不重設照片或心得。共用既有復原、恢復預設及寫入失敗保護；官方碎片不可刪除。

`tests/journal-memory.browser.py` 驗證桌面／手機橫向觸控的真實選取、拖曳、原生控制點、心得輸入、收藏點擊及重載；照片中央選檔與 HTML 故事群組另做回歸。沒有 iPhone Safari 實機驗證。

此階段完成碎片遷移，故事／心得仍使用既有 HTML 編輯器；跨頁拖曳及書脊吸附尚未實作，memoryObject.page 目前為 right。後續階段才處理統一文字控制層與跨頁歸屬，不能宣稱此階段已完成跨頁功能。
