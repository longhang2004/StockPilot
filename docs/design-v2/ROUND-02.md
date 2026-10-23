# StockPilot v2 / Round 02 — Keyly direction

**22/10/2026 · Prototype để đánh giá hướng, chưa áp dụng vào source ứng dụng.**

**Hướng này đã rút theo yêu cầu người dùng. Tiếp tục ở [ROUND-03.md](ROUND-03.md), quay lại các style trước. Nội dung dưới đây là lịch sử vòng 2.**

## Phản hồi dẫn đến vòng này

Người dùng: “tôi vẫn không ưng ý với bất kỳ cái nào, tôi cần 1 layout mới hoàn toàn” và đề xuất hướng hiện đại của https://keyly-docs.com/.

Atlas, Relay, Folio bị loại. Không chọn lọc lại ba bố cục đó hoặc thêm palette lên cùng một shell. Brief gốc vẫn giữ: portfolio có dấu ấn, SaaS dùng được, ưu tiên quản lý desktop và nhân viên mobile.

## Nghiên cứu reference

Đã mở [Keyly](https://keyly-docs.com/) bằng trình duyệt, xem hero và phần Features bằng mắt; đồng thời đọc nội dung công khai. Các nhận xét dưới đây là quan sát thiết kế, không phải kết quả nghiên cứu hiệu quả sử dụng.

| Quan sát tại Keyly                         | Chuyển sang StockPilot                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Nền gần đen, đường chia mảnh, khung vuông  | Một hệ surface graphite, phân vùng bằng border và tỷ lệ grid                                |
| Accent hồng nổi trên nền tối               | Magenta là accent thương hiệu và focus; trạng thái nghiệp vụ vẫn có nhãn riêng              |
| Headline sans lớn kết hợp serif nghiêng    | Dùng trong landing và tiêu đề chính; dữ liệu vận hành dùng sans và tabular numbers          |
| Nhãn kỹ thuật monospace, section đánh số   | Chỉ dẫn ngữ cảnh, tham chiếu, SKU; không dùng monospace cho toàn bộ body                    |
| Hero có trường phím phối cảnh và chiều sâu | Tạo trường ô hàng hóa bằng CSS, thay bàn phím bằng SKU/quantity; không sao chép asset Keyly |
| Search/keyboard language                   | Bảng tìm kiếm Ctrl+K, tìm đơn/SKU/customer/action; N tạo draft trong workspace              |

Không tải mã nguồn, cài phần mềm, sao chép nội dung marketing hoặc dùng logo/ảnh của Keyly. Dùng bộ ui-ux-pro-max có sẵn để đối chiếu dark UI, focus, responsive và tương tác. Bản sinh design system có gợi ý không đồng nhất giữa dark style và light palette; đã chọn lại palette theo reference/brief thay vì áp dụng máy móc.

## Layout mới

**Public / landing:** khung sân khấu rộng, headline hai tầng, trường ô hàng có phối cảnh, CTA rõ, bốn điểm vào luồng nghiệp vụ, ảnh chụp thật từ prototype workspace và phần giải thích Receive / Reserve / Fulfill.

**Workspace / horizontal shell:** hàng thương hiệu/workspace/search, hàng module Overview / Orders / Inventory / Manage. Điều hướng app không còn nằm trong sidebar như vòng trước.

**Control room:** ba vùng bất đối xứng: Pulse tổng hợp việc đang mở, Working set chứa đơn cần xử lý và handoff kế tiếp, Stock signal giải thích cảnh báo và tích hợp đang lỗi. Count đi cùng đường dẫn hành động; không có dãy KPI cards trang trí.

**Order / stock registers:** bảng dữ liệu trên desktop; record views trên mobile, giữ nhận diện, trạng thái và hành động chính. Search và status filter áp dụng cùng tập dữ liệu.

**Full object pages:** mở đơn hoặc SKU thành trang có URL riêng, không dùng drawer là cấu trúc chi tiết mặc định. Chia Context / Line items hoặc Balance / Stock context. Trang đơn có action bar riêng; trang SKU thể hiện `on hand − reserved = available` và đơn đang giữ hàng.

## Xem và thử

- [Landing mới](http://127.0.0.1:8765/control/)
- [Control room](http://127.0.0.1:8765/control/#workspace/overview)
- [Order register](http://127.0.0.1:8765/control/#workspace/orders)
- [Order detail](http://127.0.0.1:8765/control/#workspace/order/1002)
- [Inventory](http://127.0.0.1:8765/control/#workspace/inventory)
- [Stock explanation](http://127.0.0.1:8765/control/#workspace/stock/1)

Server chỉ phục vụ thư mục prototype tại localhost:

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory docs/design-v2/prototypes
```

Thử Ctrl+K → tìm “HP-1001” → phím xuống → Enter. Thử N ở workspace để tạo draft. Có thể duyệt SO-2026-1002, xem reserved thay đổi ở HP-1002, rồi fulfill để xem on-hand/reserved cùng giảm. Nhận thêm hàng cho SKU low stock hoặc retry storefront để quan sát trạng thái trong bộ nhớ.

Đây là dữ liệu minh họa, Manager view. Tải lại trang đặt lại model. Các module Manage mở giải thích phạm vi; chưa có prototype toàn bộ Products/Partners/Receipts/Imports/Audit/Settings/Billing. Form tạo draft minh họa một dòng; editor nhiều dòng vẫn thuộc scope v2. Không có API nghiệp vụ, database, auth hoặc thanh toán thật.

## Ảnh từ code đã render

|              | Desktop                              | Mobile                              |
| ------------ | ------------------------------------ | ----------------------------------- |
| Landing      | [Ảnh](control-landing-desktop.png)   | [Ảnh](control-landing-mobile.png)   |
| Control room | [Ảnh](control-workspace-desktop.png) | [Ảnh](control-workspace-mobile.png) |
| Order detail | [Ảnh](control-order-desktop.png)     | [Ảnh](control-order-mobile.png)     |

`prototypes/control/workspace-preview.png` là ảnh chụp viewport workspace của chính code này, phục vụ phần product preview trên landing. Không dùng ảnh giả để thay cho màn hình chưa triển khai.

## Kiểm tra

```bash
node docs/design-v2/verify-control.mjs
pnpm exec eslint docs/design-v2/prototypes/control/control.js docs/design-v2/verify-control.mjs
pnpm exec prettier --check docs/design-v2
```

Kết quả trong [control-qa.json](control-qa.json):

- 36 kiểm tra kích thước: 6 màn × 6 chiều rộng 320, 390, 768, 1024, 1280, 1440; không phát hiện page overflow.
- 14 lượt axe WCAG A/AA: sáu màn desktop/mobile và receipt dialog desktop/mobile; không còn violation trong các lượt đã chạy.
- Hai lượt workflow độc lập desktop/mobile: search/filter/empty, mở object page, confirm/reserve, fulfill/deduct, receipt/replenish, tạo draft bằng N, Ctrl+K và chọn kết quả bằng bàn phím, Escape đóng palette, retry tạo một draft.
- Kiểm tra anchor trên landing, skip link không làm đổi route workspace và reduced motion tắt smooth scroll.
- Không có page errors hay HTTP errors trong quá trình kiểm tra.

Đã xem ảnh desktop và mobile. Quá trình QA sửa tương phản nhãn navigation và CTA landing ở màn hẹp. Đây là kiểm tra prototype; chưa chứng minh độ tương phản mọi trạng thái, hỗ trợ tất cả công nghệ trợ giúp hoặc hiệu quả với người dùng thật.

## Trạng thái bàn giao

Chưa chốt design master production, chưa refactor source app, chưa commit/push/deploy. Giữ nguyên file phỏng vấn cá nhân đang untracked. Các file thay đổi ở `docs/design-v2/`.

Nếu hướng này được chốt, triển khai toàn bộ phạm vi v2 trong README theo cùng hệ thiết kế: public/auth, shell, core operations, data/operations modules, settings/team/billing và đầy đủ loading/error/empty/permission/recovery states. Không coi prototype này là bản hoàn thành toàn hệ thống.
