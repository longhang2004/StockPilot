# StockPilot v2 / Round 04 — in-app review

**23/10/2026. Prototype tương tác, chưa thay ứng dụng production.**

Landing giữ bản đồ logistics chìm dưới hero đã được người dùng đồng ý. Atlas là nền để review sâu in-app ở vòng này; chưa coi đây là lựa chọn cuối cho toàn bộ v2. Các thay đổi hành vi dùng chung cho A/B/C; `workspace.css` đặt phần tinh chỉnh shell/bảng của Atlas trong `.workspace-view.atlas`.

## Mở và thử

- [Overview](http://127.0.0.1:8765/index.html?preview=atlas&screen=overview): công việc cần xử lý và stock watch.
- [Orders](http://127.0.0.1:8765/index.html?preview=atlas&screen=orders): bảng đơn, chi tiết, xác nhận và hoàn tất.
- [Inventory](http://127.0.0.1:8765/index.html?preview=atlas&screen=inventory): on hand / reserved / available và các đơn đang giữ hàng.
- [Receipts](http://127.0.0.1:8765/index.html?preview=atlas&screen=receipts): nhập hàng, danh sách chứng từ và số tồn tại thời điểm ghi nhận.

Thử mở **Cedar Street Market / SO-2026-1002** → Confirm order → xem trước thay đổi tồn → Confirm & reserve. Drawer giữ nguyên đơn và chuyển sang bước Confirmed. Có thể Mark fulfilled ngay trong drawer, sau đó mở Inventory / Kraft Carton Large: từ **12 / 0 / 12** thành **12 / 3 / 9**, rồi **9 / 0 / 9**. Đây là dữ liệu mô phỏng, không có kiện hàng thật được xuất.

Từ Receipts, nhận thêm 5 Kraft Carton Large và nhập supplier reference. Mở chứng từ để xem lượng tăng, số tồn trước/sau và liên kết tới tồn hiện tại. Phần tồn đầu kỳ có sẵn trong snapshot minh họa; không tự tạo chứng từ lịch sử cho snapshot đó.

## Thay đổi chính

- Shell Atlas rõ vùng workspace, Operations và dữ liệu nền. Mobile có Overview / Orders / Inventory / Receipts / More.
- Bảng Orders/Inventory có ranh giới header, dòng và footer rõ; chuyển thành record cards ở chiều rộng cần thiết.
- Drawer chi tiết có phần nội dung cuộn riêng, header và hành động luôn nhìn thấy. Sau khi xác nhận/hoàn tất, drawer giữ đối tượng và cập nhật bước Draft → Confirmed → Fulfilled. Relay ở màn queue tiếp tục chuyển sang draft kế tiếp nếu đơn vừa xác nhận không còn khớp bộ lọc Draft.
- Từng dòng đơn cho thấy lượng khả dụng hoặc số thiếu. Xác nhận mở bảng tác động **on hand / reserved / available** trước/sau; đơn thiếu hàng không xác nhận được.
- Tìm kiếm workspace thực sự tra đơn/customer/product/SKU. Mở bằng nút header hoặc Ctrl/Command + K; Enter mở kết quả đầu, Escape đóng tìm kiếm. Chuyển đối tượng liên quan trong drawer đưa focus tới tiêu đề mới.
- Nhập hàng cho chọn sản phẩm, giữ nguyên reservation và tạo chứng từ. Receipts có tìm kiếm, empty state, chi tiết và liên kết tới số tồn hiện tại. Supplier reference rỗng hoặc chỉ có khoảng trắng bị chặn.
- Ảnh Overview/Orders/Inventory trên landing đã chụp lại từ code mới. Static assets có version query để tránh preview giữ code cũ trong cache.

## Kiểm tra

`node docs/design-v2/verify.mjs` → [workspace-qa.json](workspace-qa.json): **72 app viewport, 18 landing viewport, 30 lượt axe, 6 workflow desktop/mobile**, không lỗi JavaScript/HTTP trong phạm vi chạy. Bao gồm ba theme, bốn màn app, stock impact, cập nhật tồn, chứng từ và global search.

`node docs/design-v2/verify-workspace.mjs` → [workspace-overlay-qa.json](workspace-overlay-qa.json): **14 lượt axe cho các trạng thái/dialog của Atlas, 2 workflow chi tiết**. Kiểm tra nút cố định trong viewport, Enter/Escape, shortage, supplier reference, receipt → current stock và focus khi đổi đối tượng. Script cũng cập nhật chín ảnh product tour.

Ảnh review: `workspace-{orders,order,impact,search,receipts,receipt}-{desktop,mobile}.png`; Overview/Inventory desktop ở `workspace-overview-desktop.png`, `workspace-inventory-desktop.png`.

Đây chưa phải toàn bộ v2: Products, Partners, admin/team/billing/import/audit vẫn theo phạm vi README; form tạo draft trong prototype vẫn minh họa một dòng. Chưa gắn API, auth, RBAC hoặc thay logic ứng dụng thật. Số liệu chỉ ở bộ nhớ và reset khi tải lại/đổi prototype. Chưa commit, push hay deploy.
