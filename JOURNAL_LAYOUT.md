# 瑞穗自由手帳編輯（第二階段最小版本）

- 原有 StPageFlip 2.0.7 不變；新增 Fabric.js 5.3.0 瀏覽器版，MIT 授權及原文見 THIRD_PARTY_LICENSES.md / aming-game/vendor/fabric/LICENSE。
- 入口：解鎖瑞穗記憶 → 瑞穗跨頁 → 編輯手帳。Fabric 操作玩家拍立得、照片和個人貼紙；DOM 群組編輯器操作故事與心得；探索拍立得及收藏碎片已遷移為 Fabric 群組，所有敘事文字保留 HTML。
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

工具列顯示圖示及繁體中文名稱；窄視窗仍可收合。該歷史階段尚未包含跨頁，現況以本文最後的跨頁章節為準。故事／心得保留 HTML 與現有 DOM 控制。

測試：`tests/journal-cow-fabric.browser.py`（桌面／橫向觸控，兩組原生控制點與保存）；玩家照片中央上傳及更換另由 `tests/journal-photo-click.browser.py` 回歸驗證。

## 回憶碎片原生 Fabric 群組階段

新增 `journal-memory.js`：右頁乳牛奶盒與原標籤使用真正 Fabric.Group、原生八點縮放及旋轉控制桿，移除該物件的 DOM 編輯外框。原圖片、標籤與收藏事件節點保留；閱讀時使用同頁透明投影與可聚焦的點擊入口呼叫既有收藏匣。只裁切右頁 Fabric 互動畫布的命中範圍，避免透明區攔截故事與心得；不改 StPageFlip 幾何。

同一份車站存檔新增 `memoryObject`，包含 id/type/source/page/x/y/scale/angle/order，座標相對單頁 600×800。讀取舊 domObjects 的 memory-fragment 時轉換位置、寬度與角度，不重設照片或心得。共用既有復原、恢復預設及寫入失敗保護；官方碎片不可刪除。

`tests/journal-memory.browser.py` 驗證桌面／手機橫向觸控的真實選取、拖曳、原生控制點、心得輸入、收藏點擊及重載；照片中央選檔與 HTML 故事群組另做回歸。沒有 iPhone Safari 實機驗證。

該歷史階段完成碎片遷移；其跨頁限制已由下列跨頁階段取代。故事／心得仍保留 HTML 編輯器。

## 瑞穗跨頁拖曳／書脊吸附

新增 `journal-spread.js` 共用座標與面積判定。編輯暫存層位於書本展示容器內、StPageFlip 單頁外，邏輯跨頁 1200×800；不改原書頁尺寸或翻頁幾何。Fabric 畫布只在編輯時移至此層並擴大命中座標，拖曳中不做單頁限制。HTML 群組在起拖時移動原節點至暫存層，輸入、文字、換行與儲存事件保留。

放手時以旋轉矩形的四個角點進行 Sutherland–Hodgman 矩形裁切，算出與左右 600×800 書頁的交集面積。同面積（浮點誤差容限 1e-7）保留原 page，否則選多數頁。Fabric 物件過大時等比例縮小，再移回該頁 8 邏輯像素內距。HTML 文字維持可讀字級，以框寬重排與框內捲動容納全文，不將文字轉為圖片；放手也將框完整收回單頁。取消 DOM 拖曳會回復原位。完成編輯前再次檢查 Fabric 邊界，避免中斷手勢留下跨脊位置。

objects 與 memoryObject 的 page 支援 left/right，x 是相對其單頁的中心座標；DOM 的 page 與 x/y 為所屬頁的左上座標。未帶 page 的舊照片／裝飾視為 left，舊 memoryObject 的 right 與 DOM 記錄繼續可讀，不清除圖片或心得。保存、復原、預設還原均維持同一份本機資料。

閱讀時，Fabric 只輸出透明的左右單頁投影，各自附著於該張實際 StPageFlip 書頁；照片說明與碎片點擊入口也移到所屬頁。編輯層不再接收互動。HTML 放回所屬單頁的實際 DOM，沒有永久跨頁 Canvas。

測試：`node tests/journal-spread.test.cjs` 驗證交集與平手；`python tests/journal-spread.browser.py` 用真實滑鼠／CDP 觸控驗證照片、碎片、貼紙、兩個 HTML 框的跨頁、放手邊界、超大物件、頁面 metadata、右頁照片選檔、收藏、重載及原生書頁切換。尺寸 1440×900、852×393；另回歸照片選檔、碎片控制點、預設還原與封面／封底。這些為 Chromium 模擬，不是 iPhone Safari 實機驗證。

## 右側工具列文字版

主按鈕使用同列圖示＋繁體中文：闔上日記、編輯手帳／完成編輯、新增照片、新增貼紙、刪除裝飾、復原上一步、恢復預設。刪除／復原的原有停用狀態與模式判斷保留。貼紙選擇來源集中在 journal-layout.js 的 ASSETS（src＋label），每筆自動產生選單項目，無需修改主按鈕清單。

直式工具列位於書本外側右邊。書本尺寸不變，右側空間不足但左右總留白足夠時，只小幅左移書本；留白仍不足時使用上方原有留白的可收合布局。主工具列與貼紙清單皆為橫向內容的圓角長按鈕。

## 文字排版修正：隱藏來源不佔文字流

原因：奶盒遷移 Fabric 後，只將原 HTML 設 visibility:hidden，仍留在 diary-entry 中；DOM 群組搬移後失去 pf-text-column 專用浮動／order 樣式，隱藏奶盒成為標題與 p 之間的在流區塊。實測桌面標題底部約138px，第一段卻從370px開始，故事超出預估高度並進入心得區。

修正：journal-memory.js 在擷取官方位置、寬度、字級後，將原來源節點移到原單頁中的絕對定位隱藏位置。原圖片、文字與收藏事件不刪除、不複製；Fabric 的預設座標仍使用搬移前量測。journal-layout.js 對舊版只有 domObjects、尚未有 memoryObject 的存檔，也先準備碎片來源再初始化文字框。

不重排或清除自訂座標；恢復預設才重新套用目前正常文字流量測的官方位置。本次無新增 margin/translate 補丁，無修改原故事／心得內容及主進度格式。新增 tests/journal-text-flow.browser.py 驗證首次、編輯、舊資料（保持原值）、儲存重載、寬度調整、恢復預設及往返目錄；跨頁與碎片操作另做回歸。
