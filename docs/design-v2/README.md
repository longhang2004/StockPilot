# StockPilot v2 — brief và bộ mẫu lựa chọn

Brief: **22/10/2026**. Cập nhật: **23/10/2026 — người dùng đã duyệt Atlas v2 để cập nhật chính thức**.

Quyết định này thay thế các ghi chú chưa chốt ở những vòng khám phá bên dưới. [Design master](../../design-system/stockpilot/MASTER.md) hiện dùng Atlas; [album và clip](demo-media-20261023/README.md) ghi lại bản đã được review.

## Ứng dụng thật

[**Mở StockPilot v2**](http://localhost:3000/app/orders) · [Landing](http://localhost:3000/) · [Phạm vi và kiểm chứng](IMPLEMENTATION.md).

Source Next.js, API và hợp đồng chứng từ đã cập nhật trên nhánh `codex/stockpilot-atlas-v2`. Bản local dùng API/PostgreSQL thật. Phát hành qua PR → CI → `main` → Vercel/Render. Các vòng dưới đây là lịch sử prototype và nghiên cứu trước khi triển khai.

## Prototype in-app — vòng 4

[**Mở in-app Atlas**](http://127.0.0.1:8765/index.html?preview=atlas&screen=orders). Đã tinh chỉnh shell/bảng, thêm drawer giữ hành động, tiến trình đơn và xem trước tác động tồn; global search Ctrl/Command + K; nhập hàng tạo chứng từ có thể tra lại trong Receipts. Mobile có bốn màn nghiệp vụ và More.

Chi tiết luồng review, giới hạn và bằng chứng prototype ở [ROUND-04.md](ROUND-04.md), [workspace-qa.json](workspace-qa.json) và [workspace-overlay-qa.json](workspace-overlay-qa.json). Sau vòng này, người dùng đồng ý bắt đầu triển khai; trạng thái source thật xem [IMPLEMENTATION.md](IMPLEMENTATION.md).

## Landing — vòng 3 đã tinh chỉnh

Người dùng yêu cầu quay lại các style trước, học hỏi landing và in-app có bố cục đẹp, gọn, có điểm nhấn và ít rối. Đã rút Keyly khỏi entry point. Giữ Atlas / Relay / Folio làm nền thị giác, tinh chỉnh composition, thêm landing có product tour và giảm thông tin lặp trong app.

Mở **[bộ mẫu hiện tại](http://127.0.0.1:8765/)**. Chọn **Landing page / Ứng dụng** để xem cùng một style ở hai bề mặt. **Mở riêng** để có toàn bộ chiều rộng cửa sổ; **Co giãn / Mobile** để đổi cách xem. Atlas là mặc định để tiếp tục review, chưa phải lựa chọn cuối được người dùng chốt.

Chi tiết tham khảo, thay đổi và kiểm tra mới ở **[ROUND-03.md](ROUND-03.md)**.

**Cập nhật 23/10, theo làm rõ mới nhất:** canvas là **bản đồ logistics chìm dưới toàn bộ hero**, giữ cách bố trí nền của Keyly. Bản đồ có kho, tuyến vận chuyển, kiện hàng và mã đơn di chuyển. Khôi phục hero căn giữa; đã bỏ panel quy trình độc lập. Màu thay theo A/B/C, có pause/play và reduced motion. Kiểm tra ở [map-qa.json](map-qa.json).

## Vòng 2 — hướng Keyly đã rút

Ở vòng 2, người dùng chưa chọn A/B/C và đề xuất tham khảo Keyly. Sau khi xem prototype đó, người dùng yêu cầu quay lại các style trước. Bản Keyly hiện chỉ được lưu làm lịch sử khám phá.

Mở **[prototype vòng 2](http://127.0.0.1:8765/control/)** hoặc vào thẳng **[workspace mới](http://127.0.0.1:8765/control/#workspace/overview)**. Brief bổ sung, ảnh và kết quả kiểm tra mới ở **[ROUND-02.md](ROUND-02.md)**. Hướng này có landing, shell điều hướng ngang, bàn điều hành, register và full object pages; không phải theme thứ tư trên layout cũ.

## Brief đã xác nhận

- Mục tiêu: vừa có dấu ấn để trình bày portfolio, vừa phát triển được thành SaaS vận hành thực tế.
- Ưu tiên: quản lý/chủ doanh nghiệp trên desktop; nhân viên thao tác được trên mobile.
- Vấn đề người dùng nêu: giao diện đơn giản, cảm giác “AI-slop”, bố cục chưa hợp lý.
- Được phép tham khảo website/sản phẩm cùng lĩnh vực.
- Quy mô có thể là viết lại frontend v2. Hướng cuối cùng do người dùng chọn sau khi trải nghiệm mẫu.
- Chưa chốt ngôn ngữ hoặc yêu cầu light/dark cho sản phẩm cuối. Mẫu dùng UI tiếng Anh như ứng dụng hiện tại; phần hướng dẫn chọn mẫu bằng tiếng Việt.

## Khảo sát hiện trạng

Đã đọc cấu trúc Next.js 16 / React 19, các phần shell/navigation, Overview, Orders, Inventory, token CSS, design master và tài liệu thiết kế trước đó. Đã xem ảnh QA desktop Overview/Orders ngày 19/10/2026 trong repository. Đây là đánh giá từ mã nguồn và ảnh đã lưu, không phải kiểm thử deployment hiện tại hoặc nghiên cứu người dùng.

| Phát hiện                                                                           | Cơ sở                                                                    | Hướng xử lý trong v2                                                                                          |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Overview kéo dài theo từng nhóm ngoại lệ; phần ngữ cảnh bị đẩy xuống dưới           | `features/overview/overview-workspace.tsx`, ảnh `desktop-overview.jpg`   | Phân vai rõ tổng quan / quyết định / ngữ cảnh; giữ công việc quan trọng ở màn hình đầu                        |
| Header chứa đồng thời workspace, vai trò demo, danh tính và đăng xuất               | `components/app/workspace-navigation.tsx`                                | Chuyển workspace và tài khoản vào vùng điều hướng; giảm cạnh tranh với nội dung chính                         |
| Cùng một bố cục danh sách cần phục vụ cả quản lý và người xử lý nhiều đơn           | `features/orders/orders-workspace.tsx`                                   | So sánh bảng + chi tiết theo ngữ cảnh với queue + chi tiết cố định                                            |
| Toolbar Inventory ghép tìm kiếm balances với bộ lọc chỉ tác động alerts ở vùng khác | `features/inventory/inventory-workspace.tsx`                             | Bộ lọc phải tác động đúng tập dữ liệu ngay bên dưới; phân biệt cảnh báo và số dư                              |
| Đã có semantic tokens, primitives, xử lý lệnh và URL state                          | `app/styles/foundation.css`, `components/ui`, `hooks`, `features/shared` | Tận dụng nền tảng; thiết kế lại cấu trúc và phân cấp, thay vì chỉ đổi palette hoặc thêm một lớp CSS ghi đè    |
| Mật độ, kiểu chữ và phân cấp chưa tạo được nhận diện người dùng mong muốn           | Phản hồi người dùng + ảnh QA                                             | Đánh giá ba ngôn ngữ thị giác bằng cùng nghiệp vụ, tránh số liệu trang trí và chi tiết không phục vụ thao tác |

Đây là giả thuyết thiết kế cần kiểm chứng, chưa có số liệu về thời gian hoàn thành tác vụ hay mức độ hài lòng.

## Ba style gốc — dùng lại ở vòng 3, có tinh chỉnh layout

|                   | A — Atlas                                    | B — Relay                                        | C — Folio                                                       |
| ----------------- | -------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| Ý tưởng           | Rõ ràng để điều hành                         | Tập trung để xử lý                               | Nhìn rõ bước tiếp theo                                          |
| Shell             | Sidebar có nhãn, header nhẹ                  | Rail thu gọn, nền tối                            | Điều hướng ngang, nền ấm                                        |
| Điểm khác biệt UX | Tổng quan công việc và stock watch cạnh nhau | Hàng đợi bên trái, nội dung đơn bên phải         | Nhóm công việc theo Review / Fulfill / Replenish                |
| Cá tính           | Xanh evergreen, sans, ít chrome              | Graphite, mint, mật độ cao hơn                   | Typography có serif ở tiêu đề, đường chia mạnh, accent ink-blue |
| Đánh đổi          | Cần mở chi tiết khi chuyển đơn               | Cần làm quen mật độ; mobile chuyển list → detail | Tác vụ dạng cột cần giới hạn/pagination khi dữ liệu lớn         |
| Hướng phù hợp     | Quản lý dùng hằng ngày                       | Nhóm xử lý đơn liên tục                          | Portfolio có dấu ấn và luồng vận hành dễ hiểu                   |

Mỗi hướng đều có **Overview, Orders, Inventory**; tìm kiếm/bộ lọc; chi tiết đơn; xác nhận/hoàn tất đơn; giải thích tồn và đơn đang giữ hàng; nhận hàng; tạo draft; và xem/retry tích hợp mô phỏng. B mở Orders trước để người xem thấy rõ mô hình hàng đợi.

Receipts đã có luồng nhập hàng và chứng từ ở vòng 4. Các module phụ khác mở một bảng giải thích phạm vi, chưa có prototype đầy đủ. Form tạo draft minh họa một dòng sản phẩm; sản phẩm cuối vẫn cần editor nhiều dòng. Mẫu là Manager view, chưa mô phỏng toàn bộ phân quyền Owner/Staff. Bộ lọc demo và dữ liệu hiện ở bộ nhớ, chưa phải URL state hay API production.

Số liệu và sự kiện là dữ liệu minh họa theo tên/luồng của demo, không phải bản sao database hiện tại. Tải lại hoặc đổi hướng sẽ đặt lại dữ liệu. Không có request API nghiệp vụ, đăng nhập, thanh toán hoặc tác động dữ liệu thật.

## Cách mở lại

Chạy trong Ubuntu WSL, từ thư mục repository:

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory docs/design-v2/prototypes
```

Mở [prototype hiện tại](http://127.0.0.1:8765/). Ba mẫu vòng 1 còn được lưu tại [archive.html](http://127.0.0.1:8765/archive.html). Ở gallery cũ, nút Desktop/Mobile đổi chiều rộng iframe thực tế.

| Mẫu   | Desktop đại diện         | Mobile đại diện         |
| ----- | ------------------------ | ----------------------- |
| Atlas | [Ảnh](atlas-desktop.png) | [Ảnh](atlas-mobile.png) |
| Relay | [Ảnh](relay-desktop.png) | [Ảnh](relay-mobile.png) |
| Folio | [Ảnh](folio-desktop.png) | [Ảnh](folio-mobile.png) |

Font Source Sans 3 và giấy phép OFL được sao chép từ asset có sẵn của ứng dụng. SVG sinh từ `@phosphor-icons/react` đã cài, giữ giấy phép MIT trong `icons.js`. Không thêm dependency hay tải font ngoài.

## Tham khảo và cách áp dụng

- [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill): đã đọc repo và chạy bản skill có sẵn trong `.agents/skills/ui-ux-pro-max`. Dùng `--design-system`, tra cứu style, typography, Next.js và accessibility. Kết quả là dữ liệu tham khảo; lựa chọn cuối vẫn dựa vào brief và ngữ cảnh StockPilot.
- [Zoho Inventory — Dashboard](https://www.zoho.com/inventory/help/getting-started/dashboard.html): tài liệu mô tả summary, pending actions và đường mở thông tin chi tiết. Áp dụng nguyên tắc nối chỉ số với việc cần xử lý.
- [inFlow — Sales orders](https://www.inflowinventory.com/support/cloud/how-do-i-create-and-complete-a-sales-order): tham khảo cách nhóm thông tin, dòng hàng và hành động trong chi tiết đơn.
- [Katana — Screen structure](https://support.katanamrp.com/en/articles/5908373-understanding-the-basics-of-each-katana-screen): tham khảo tách luồng bán hàng/tồn kho và liên kết availability với hành động bổ sung tồn.

Đây là tham khảo từ tài liệu công khai, không truy cập tài khoản sản phẩm. Không sao chép thương hiệu hay màn hình đối thủ. Không đưa manufacturing, purchase orders, barcode, đa kho hoặc chức năng ngoài scope hiện tại vào roadmap chỉ vì sản phẩm tham khảo có chúng.

## Phạm vi v2 sau khi chọn hướng

V2 bao phủ toàn bộ trải nghiệm, không dừng ở ba màn prototype:

1. **Foundation và app shell:** tokens, type scale, spacing, iconography, controls, sidebar/header/mobile navigation, workspace switching, vai trò và tài khoản.
2. **Luồng cốt lõi:** Overview, Orders, Inventory, Receipts; chi tiết đối tượng, tạo/sửa, trạng thái, liên kết nguồn chứng từ và hành động tiếp theo.
3. **Dữ liệu và vận hành:** Products, Partners, Imports/CSV, Integrations/retry, Audit và các bộ lọc/ngữ cảnh liên quan.
4. **Tài khoản và quản trị:** login/signup, tạo workspace, nhận lời mời, organization/team/invitations, billing và thông báo giới hạn quyền/plan.
5. **Trải nghiệm công khai:** landing, demo entry, hình ảnh sản phẩm, responsive và brand assets tương ứng hướng đã chọn.
6. **Trạng thái và nghiệm thu:** loading/empty/error/permission/expired session/unknown command outcome, bàn phím, focus, text zoom, reduced motion, dữ liệu dài và đầy đủ desktop/mobile.

Đề xuất kỹ thuật: cho phép viết lại composition/layout của frontend nhưng tái sử dụng data layer, API/contracts và xử lý lệnh khi đáp ứng yêu cầu. Chỉ thay backend khi thiết kế cụ thể chứng minh dữ liệu/hành động còn thiếu. Giữ ý nghĩa trạng thái đơn, tenant/RBAC, `available = onHand - reserved`, idempotency và phục hồi lệnh chưa rõ kết quả.

Sau lựa chọn: khóa một design master, thiết kế sâu một luồng end-to-end, rồi triển khai theo module với kiểm thử hồi quy. Không áp dụng ba theme vào sản phẩm cuối hoặc dựng một hệ UI mới song song với hệ cũ. Design master ngày 18/10 được giữ nguyên trong giai đoạn khám phá; palette/typography của mẫu chưa phải quyết định production.

## Kiểm tra prototype vòng 1 — lịch sử

Chạy kiểm tra khi server ở trên đang hoạt động:

```bash
node docs/design-v2/verify.mjs
```

Kết quả hiện tại được lưu trong [qa.json](qa.json): 54 kiểm tra kích thước (3 hướng × 3 màn × 6 chiều rộng 320/375/390/768/1024/1440), 18 lượt axe theo WCAG A/AA, 6 lượt workflow desktop/mobile và kiểm tra gallery đổi hướng/viewport. Không phát hiện page overflow, lỗi JavaScript, HTTP lỗi hoặc vi phạm axe trong các trường hợp đã chạy. Đã xem ảnh desktop/mobile bằng mắt.

Kiểm tra xác nhận Draft → Confirmed làm tăng reserved; Confirmed → Fulfilled giảm on-hand và reserved; receipt tăng on-hand; tạo draft chưa reserve; search/filter/empty state; đóng modal bằng Escape. Đây là kiểm tra **prototype**, không thay thế unit/integration/E2E của ứng dụng thật, kiểm chứng độ tương phản mọi trạng thái hoặc thử nghiệm với người dùng.

Tại thời điểm vòng 1, chưa thay source ứng dụng hoặc commit/push/deploy. File phỏng vấn cá nhân không thuộc thay đổi UI này.

## Bước tiếp theo

Atlas đã được triển khai và duyệt. Hoàn tất cổng CI, merge và xác minh revision của bản online theo runbook phát hành. ROUND-03 và ROUND-04 giữ lại bối cảnh thiết kế, không phải yêu cầu mở lại việc chọn mẫu.
