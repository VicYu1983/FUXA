# 如何在 FUXA 新增 SVG Widget

本文說明如何製作一個 SVG Widget 並在 FUXA 中使用。範例為同資料夾的 [test-widget.svg](./test-widget.svg)，包含一個圖示（icon）、一個標籤（label）以及數字、字串、顏色三種參數的測試。

> 官方說明見 [server/_widgets/README.md](../README.md) 與 FUXA 專案的 `docs/HowTo-Widgets.md`。

## 1. Widget 檔案結構

Widget 是一個 `.svg` 檔，SVG 內容加上一個 `<script>`：

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="90" viewBox="0 0 180 90">
  <!-- 畫面元素 -->
  <script><![CDATA[
    //!export-start
    var _pn_value = 50;
    //!export-end

    function putValue(id, value) { ... }
  ]]></script>
</svg>
```

- `<script>` 會在載入時被 FUXA 抽出、重新命名 ID 後再注入，因此腳本可以用 `document.getElementById` 存取 SVG 元素。
- 建議使用 `<![CDATA[ ... ]]>` 包住腳本，避免 `<`、`&` 等字元破壞 XML。

## 2. 宣告可綁定參數（export 區塊）

在 `//!export-start` 與 `//!export-end` 之間宣告的全域變數，會出現在 FUXA 屬性面板中，可綁定 FUXA Tag。變數名稱的**前綴決定型別**：

| 前綴 | 型別 | 宣告範例 |
|------|------|----------|
| `_pn_` | 數字（Int、Float 等） | `var _pn_value = 50;` |
| `_ps_` | 字串，值需用單引號 | `var _ps_label = 'Label';` |
| `_pc_` | 顏色，十六進位代碼 | `var _pc_color = '#3366cc';` |
| `_pb_` | 布林值 | `var _pb_on = false;` |

注意事項：
- 變數必須放在 export 區塊內，且使用 `var`、`let` 或 `const` 宣告並賦予初始值。FUXA 會以字串取代該宣告，請保持一行一個宣告的寫法。
- 變數名稱即 Tag 綁定時的識別名稱，改名後需重新綁定。

## 3. 接收 FUXA 的值：`putValue`

FUXA 的 Tag 值變化時會呼叫 `putValue(id, value)`，`id` 為變數名稱：

```js
function putValue(id, value) {
  if (id === '_pn_value') {
    document.getElementById('value').textContent = 'Value: ' + value;
  }
}
```

## 4. 回傳值給 FUXA：`postValue`

在腳本中呼叫 `postValue(變數名稱, 值)`，會觸發已綁定 Tag 的寫入事件：

```js
postValue('_pn_value', _pn_value);
```

`postValue` 的 ID 必須與 export 區塊中的變數名稱完全相同。

## 5. 加入 SVG 元素

- 每個需要更新或互動的元素請設定唯一的 `id`，例如 `<text id="label">`。
- 互動可直接使用 `addEventListener`，例如點擊圖示：

```js
document.getElementById('icon').addEventListener('click', function () {
  _pn_value = _pn_value + 1;
  postValue('_pn_value', _pn_value);
});
```

- 可使用 SVG 內的 `<style>` 或 `style` 屬性處理 CSS。

## 6. 放入 FUXA 並綁定

1. 將 `.svg` 檔放入 `server/_widgets/` 下的分類資料夾（本範例為 `indicator/`），新增分類時可自行建立資料夾。
2. 在 FUXA 編輯器中使用 **Embedded Image Import** 匯入該 SVG。
3. 選取元件，在屬性面板的 SVG 屬性中，為每個參數綁定 FUXA Tag。
4. 執行 FUXA 檢查：
   - 更改 Tag 值，`putValue` 是否更新 Label、數值文字與顏色。
   - 點擊圖示，綁定的 Tag 是否收到寫入值。

## 7. 測試檢查清單

- [ ] SVG 為格式正確的 XML（可用瀏覽器開啟或 PowerShell `[xml]` 檢查）。
- [ ] 所有參數都在 export 區塊內，且前綴正確。
- [ ] `putValue` 能處理每個參數的 ID。
- [ ] `postValue` 的 ID 與變數名稱一致。
- [ ] 元素 ID 在同一 SVG 中不重複。

## 注意事項

- Widget 腳本在主頁面執行，沒有沙箱隔離，請只使用可信來源的程式碼。
- 本範例尚未在執行中的 FUXA 完整驗證，使用前請依第 6、7 節測試。
- 若要改用其他 Widget 格式或 API（例如 `callFunction`），請以官方 `docs/HowTo-Widgets.md` 為準。
