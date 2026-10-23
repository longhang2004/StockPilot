# Atlas v2 — triển khai thực tế

23/10/2026 · nhánh `codex/stockpilot-atlas-v2`.

**Đã được người dùng duyệt cập nhật chính thức ngày 23/10/2026**, sau khi xem bộ 18 ảnh và clip từ ứng dụng thật. Atlas là hướng hiện hành trong [design master](../../design-system/stockpilot/MASTER.md). Phát hành qua PR, CI và quy trình Vercel/Render hiện có; trạng thái kiểm chứng dưới đây mô tả môi trường local trước phát hành.

Thiết kế đã được đưa vào Next.js trong `apps/web`, dùng Nest API và PostgreSQL local. Prototype ở cổng 8765 được giữ để đối chiếu; bản ứng dụng thật chạy ở [localhost:3000](http://localhost:3000).

## Phạm vi

- Landing: hero canvas logistics chìm dưới nội dung, nút dừng/chạy, reduced motion, tự dừng khi khuất hoặc tab không hoạt động; product tour dùng ảnh chụp ứng dụng và asset hash của Next để tránh cache ảnh cũ; CTA vào demo và signup thật.
- Hệ thống Atlas: token màu xanh/trung tính, typography, sidebar, header, bảng, form, trạng thái, auth và các màn hỗ trợ thống nhất; mobile có Overview / Orders / Inventory / Receipts / More.
- Overview: số liệu API, việc cần xử lý, stock watch, hướng dẫn demo có thể mở khi cần và ngữ cảnh hoạt động.
- Orders: giữ danh sách phía sau drawer; dòng hàng dạng card trên mobile, tiến trình, khả dụng từng dòng, preview tồn trước/sau, chặn thiếu hàng, giữ chi tiết sau xác nhận/hoàn tất; giữ form nhiều dòng, RBAC và khôi phục cùng idempotency key khi mất phản hồi.
- Inventory: drawer giải thích tồn, reservation liên kết đơn, lịch sử nguồn và điều chỉnh tồn.
- Receipts: mở chứng từ sau khi nhập; tồn trước/sau lấy từ movement gốc, phân biệt với liên kết tới tồn hiện tại. API thêm hai trường tùy chọn `onHandBefore` / `onHandAfter` vào mỗi dòng chứng từ; không cần migration.
- Tìm kiếm Ctrl/Command + K: đơn/customer, product/SKU và khách hàng từ API; Enter mở kết quả đầu; liên kết khách hàng áp dụng bộ lọc Partners.
- Drawer dùng portal, focus vào tiêu đề hoặc trường tìm kiếm, giữ Tab/Shift+Tab, hỗ trợ Escape và phục hồi focus. Header/footer có vùng riêng, form giữ hàng nút thao tác khi cuộn.

## Kiểm chứng

- Frontend unit: **77/77**; chạy thêm các test liên quan sau khi chỉnh focus, overview và ảnh/SEO đều qua.
- Integration nhận hàng: **4/4**, gồm tenant isolation, idempotency, số tồn lịch sử giữ nguyên sau điều chỉnh tiếp theo và quyền Staff.
- [Browser regression](implementation-qa/e2e-suite.txt) trên API/database thật, frontend build: **51 qua, 1 bỏ qua có chủ ý** (kiểm tra sidebar desktop không áp dụng cho project mobile). Sau chỉnh sửa cuối cho dòng hàng, chạy lại [hai workflow Atlas trên desktop/mobile](implementation-qa/e2e-order-lines.txt): đều qua, bao gồm dòng hàng thực sự nằm trong viewport ở 320/390/768px và axe trong drawer.
- [Ma trận UI](implementation-qa/results.json): **48 viewport, 28 lượt axe** theo WCAG 2 A/AA và 2.1 A/AA, không tràn ngang hoặc lỗi JavaScript trong phạm vi kiểm tra; gồm search, order drawer, stock impact và receipt detail.
- Canvas: kiểm tra pixel thay đổi khi chạy, đứng yên khi dừng, chạy lại và đứng yên theo reduced motion.
- Build frontend/API, typecheck, lint và kiểm tra whitespace đã chạy.

E2E bao gồm signup → workspace → mời/nhận lời mời, đăng nhập/đăng xuất, form nhiều dòng, nhận hàng → giữ tồn → hoàn tất, thiếu hàng, mất phản hồi rồi tải lại, phân quyền, webhook trùng, deep link/history, font, SKU dài, SEO và accessibility.

## Chạy lại

Theo [hướng dẫn WSL](../development-wsl.md) để chạy PostgreSQL và API local. Frontend cần `SITE_URL` khi build:

```bash
SITE_URL=http://localhost:3000 pnpm --filter @stockpilot/web build
SITE_URL=http://localhost:3000 pnpm --filter @stockpilot/web start
pnpm --filter @stockpilot/web test:unit
ATLAS_URL=http://localhost:3000 node docs/design-v2/verify-implementation.mjs
```

Bộ browser regression dùng profile không khởi động server, trỏ tới các process local đang chạy:

```bash
E2E_BASE_URL=http://localhost:3000 WEB_ORIGIN=http://localhost:3000 \
WEBHOOK_SIGNING_SECRET='replace-with-the-local-api-value' \
pnpm exec playwright test --config playwright.production.config.ts
```

`CAPTURE_ONLY=1 node docs/design-v2/verify-implementation.mjs` chụp lại ảnh, dùng bộ lọc số đơn `SO-2026` và SKU `HP-` để minh họa dữ liệu seed giữa các fixture kiểm thử. Script chụp không reset hoặc ghi dữ liệu nghiệp vụ. Lần reset tùy chọn trước khi chụp đã bị automatic approval review từ chối vì nguy cơ xóa dữ liệu local; ảnh dùng dữ liệu hiện có.

Kho dependency pnpm ngoài checkout WSL gây cảnh báo tracing của standalone khi build. CI dùng môi trường build chuẩn và bộ production-image regression làm cổng kiểm chứng Docker/đóng gói trước khi merge. Xác minh độc lập revision web `/version` và API readiness sau rollout, theo [runbook](../deployment.md).
