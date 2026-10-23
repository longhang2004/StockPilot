# StockPilot v2 / Round 03 — quay lại style trước, tinh gọn layout

**Ngày: 22/10/2026. Phạm vi: prototype; source ứng dụng thật chưa thay đổi.**

## Yêu cầu mới nhất

“thôi quay về các style trước đó nhé” và yêu cầu học hỏi layout landing/in-app có sẵn, đẹp, gọn, gây ấn tượng nhưng không rối.

Đã phục hồi entry point A / Atlas, B / Relay, C / Folio. Keyly không còn là hướng hiện tại. Atlas là style xem mặc định, không phải quyết định cuối thay người dùng.

## Tham khảo đã xem trực tiếp

| Nguồn chính thức                           | Quan sát                                                                           | Áp dụng vào StockPilot                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [Attio](https://attio.com/)                | Hero tập trung một headline, mô tả ngắn, CTA và phần trình diễn sản phẩm           | Landing ưu tiên thông điệp và preview, không tăng số khối nội dung để tạo cảm giác đầy                   |
| [Linear](https://linear.app/)              | Public product demo có navigation, nội dung chính và ngữ cảnh chi tiết phân lớp rõ | Giữ shell dễ nhận biết; tách tác vụ chính khỏi lịch sử/phần phụ; hành động nằm cùng đối tượng đang xử lý |
| [inFlow](https://www.inflowinventory.com/) | Giới thiệu trực tiếp vấn đề inventory, CTA rõ và UI sản phẩm theo ngữ cảnh         | Copy bám kho/đơn B2B; trình diễn quy trình của StockPilot thay vì một hero mang tính trang trí           |

Đã đọc các trang qua web và xem screenshot trực tiếp trong browser. Đây là quan sát bố cục, không phải nghiên cứu hiệu quả sản phẩm hay bằng chứng chuyển đổi. Không đăng nhập dịch vụ, sao chép asset, khách hàng, logo, số liệu hoặc tuyên bố AI của họ.

## Landing

Giữ một câu chuyện ngắn:

1. Navigation nhỏ và hero với một lời hứa cụ thể: biết tồn kho, giữ đơn hàng tiếp tục đi.
2. CTA chính mở workspace; CTA phụ tới quy trình.
3. Product tour chuyển giữa Overview / Orders / Inventory bằng ảnh chụp từ chính code đã render. Mỗi tab dẫn tới đúng màn prototype.
4. Ba lợi ích ngắn, sau đó là một phần quy trình Receive / Reserve / Fulfill bằng native disclosure.
5. Một CTA kết và footer ngắn.

Màu và typography thay theo A/B/C, không thêm style mới. Không dùng social proof giả, số liệu tăng trưởng, logo đối tác hoặc screenshot đối thủ. Ảnh preview ở `prototypes/assets/{atlas,relay,folio}-{overview,orders,inventory}.png`; có chín ảnh, đều chụp từ viewport 1440×960 của prototype.

### Canvas hiện tại: bản đồ logistics chìm dưới hero — 23/10/2026

Người dùng làm rõ: giữ canvas như một lớp nền chìm bên dưới nội dung giống Keyly, với đơn vận chuyển trên bản đồ các kho. Bản panel quy trình bên cạnh nội dung ở lượt trước đã được thay thế.

- Hero trở lại căn giữa. Canvas phủ toàn bộ chiều rộng/chiều cao hero ở lớp dưới chữ và CTA, không nằm trong card hoặc cột minh họa riêng.
- Bản đồ phối cảnh có các ô phố, tuyến đường, đường nước và các kho/hub. Kiện hàng kèm mã đơn minh họa di chuyển trên tuyến cong giữa các kho; vệt đường và vòng nhẹ quanh kho biểu thị hoạt động.
- Vùng giữa có mask làm chìm bản đồ, mép trên/dưới tan vào surface. Nội dung hero vẫn đọc được; màu bản đồ lấy từ palette A/B/C. Mobile giảm cường độ nền.
- Bản đồ, địa điểm và đơn hàng đều tự vẽ và hư cấu, được ghi “Illustrative logistics network”. Không gọi dịch vụ bản đồ hoặc API vận chuyển, không tuyên bố có tracking thực trong sản phẩm.
- Nút **Pause motion / Play motion** dùng được bằng chuột/bàn phím. Canvas chỉ trang trí và được ẩn khỏi accessibility tree. Reduced motion giữ mạng lưới tĩnh. Tự dừng khi hero ra khỏi viewport/tab bị ẩn; kiểm tra lại tùy chọn khi cửa sổ nhận focus.
- Cache lớp bản đồ tĩnh trong canvas phụ; mỗi frame chỉ vẽ lại các đơn và vòng hoạt động. Giới hạn vẽ 30fps và DPR 2×. Không thêm thư viện. Khi Canvas không khả dụng, hero và CTA vẫn hoạt động.

Kiểm tra: `node docs/design-v2/verify-canvas.mjs`. Bằng chứng hiện tại ở [map-qa.json](map-qa.json); ảnh ở `map-{atlas,relay,folio}-{desktop,mobile}.png`. Kiểm tra 18 viewport, axe desktop/mobile, lớp canvas nằm dưới nội dung và phủ toàn hero, CTA không bị cắt, chuyển động nhìn thấy trong ảnh render, pause/resume, offscreen, reduced motion, mô phỏng sự kiện đổi tùy chọn chuyển động, DPR và fallback không có Canvas. Ở runtime kiểm tra này, media emulation cập nhật `matches` nhưng không phát sự kiện change; script phát sự kiện đó trên chính MediaQueryList để kiểm tra handler. Chưa xác minh đổi tùy chọn từ cài đặt hệ điều hành hoặc đo hiệu năng trên điện thoại thật.

Các file `canvas-qa.json` / `canvas-*.png` thuộc nền ô phối cảnh trước; `flow-qa.json` / `flow-*.png` thuộc panel quy trình đã bỏ, chỉ giữ làm lịch sử. Chỉ cập nhật prototype landing; in-app và production chưa đổi.

## In-app

**Bản review sâu hiện tại ở [ROUND-04.md](ROUND-04.md).** Phần dưới ghi lại thay đổi vòng 3.

- Overview đổi về tiêu đề tác vụ trực tiếp, bỏ nhãn ngày lớn ở đầu.
- Nhóm summary vào một hàng gọn, giữ worklist là nội dung chính và stock watch là phần hỗ trợ.
- Bỏ bảng recent orders lặp lại đúng các đơn đang có trong worklist/flow; giữ liên kết tới register đầy đủ.
- Giảm khoảng trống và làm rõ ranh giới nhóm bằng surface/border tiết chế.
- Activity của chi tiết đơn chuyển vào native disclosure để nội dung phụ không đẩy thao tác ra khỏi tầm nhìn.
- Trong Relay, nút Confirm / Fulfill ở đầu đối tượng đang chọn; trong modal giữ hành động ở footer. Mỗi view chỉ có một nút chính cho thao tác đó.
- Giữ phân biệt trạng thái, phương trình tồn và các thao tác mô phỏng đã có. Các module chưa dựng vẫn có thông báo phạm vi.

Đây là tinh chỉnh composition và mật độ trên ba style gốc, không phải biến thể neon/dark-grid của Keyly.

## Xem

- [Bộ mẫu](http://127.0.0.1:8765/?concept=atlas&surface=landing): A/B/C, Landing / Ứng dụng, Co giãn / Mobile.
- [Landing Atlas](http://127.0.0.1:8765/index.html?preview=atlas&surface=landing)
- [Ứng dụng Atlas](http://127.0.0.1:8765/index.html?preview=atlas)
- [Relay / Orders](http://127.0.0.1:8765/index.html?preview=relay&screen=orders)
- [Folio](http://127.0.0.1:8765/index.html?preview=folio)

Server hiện chỉ phục vụ thư mục prototype qua localhost:

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory docs/design-v2/prototypes
```

## Kiểm tra

```bash
node docs/design-v2/verify.mjs
pnpm exec eslint docs/design-v2/prototypes/app.js docs/design-v2/prototypes/landing.js docs/design-v2/verify.mjs
pnpm exec prettier --check docs/design-v2
```

Bằng chứng mới ở [refined-qa.json](refined-qa.json): **54 lượt viewport cho app, 18 lượt cho landing, 24 lượt axe và 6 lượt workflow đều đạt trong phạm vi đã chạy**. Không phát hiện lỗi JavaScript hoặc HTTP lỗi. Gallery đổi được style, Landing/Ứng dụng và Mobile.

Script kiểm tra ba màn app ở sáu chiều rộng của ba style; landing ở cùng các chiều rộng; axe trên desktop/mobile; tab product tour và đích CTA. Đồng thời kiểm tra ảnh load được và nút hero không bị cắt ngang, thay vì chỉ kiểm tra page overflow. Đã xem ảnh landing và app trên desktop/mobile bằng mắt.

Không coi việc source lint/format hoặc screenshot xuất được là bằng chứng đã refactor toàn hệ thống. Chưa commit, push hay deploy; chưa thay auth/API, data layer, RBAC hay logic tồn kho của ứng dụng thật. Phạm vi v2 cuối cùng vẫn là toàn bộ module trong README sau khi thiết kế được chốt.
