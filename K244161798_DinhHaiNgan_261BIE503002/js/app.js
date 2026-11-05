const API_URL = "https://fakestoreapi.com/products";

const DATA = {
    products: "data/products.xml",
    reviews: "data/reviews.xml",
    employees: "data/employees.json",
    customers: "data/customers.json",
    carts: "data/carts.xml"
};

const $ = (selector, root = document) => root.querySelector(selector);

const money = value =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(value);

const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));

const COLOR_POOL = [
    "Đen", "Trắng", "Xám", "Xanh",
    "Nâu", "Đỏ", "Vàng", "Hồng"
];

let products = [];
let cart = {};
let currentUser = null;
let reviews = [];

function readStorage(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
        return fallback;
    }
}

function writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function saveProductsXML(xml) {
    localStorage.setItem("hza_products_xml", xml);
}

function getProductsXML() {
    return localStorage.getItem("hza_products_xml");
}

async function loadProducts() {
    renderSkeletons();

    try {
        let xml = getProductsXML();

        if (xml) {
            products = parseProductsXML(xml);

            renderCategories();
            renderProducts();

            return;
        }

        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error("API không phản hồi");
        }

        const apiProducts = await response.json();

        products = apiProducts.map((p, index) => ({
            id: p.id,
            title: p.title,
            price: p.price,
            description: p.description,
            category: p.category,
            image: p.image,
            rating: p.rating?.rate ?? 0,
            ratingCount: p.rating?.count ?? 0,
            color: COLOR_POOL[index % COLOR_POOL.length],
            stock: 8 + (index * 7 % 24),
            variant: "Mặc định"
        }));

        xml = productsToXML(products);

        saveProductsXML(xml);

        renderCategories();
        renderProducts();

    } catch (error) {
        console.error(error);

        try {
            const response = await fetch(DATA.products);

            if (!response.ok) {
                throw new Error("Không đọc được file XML");
            }

            const xml = await response.text();

            products = parseProductsXML(xml);

            saveProductsXML(xml);

            renderCategories();
            renderProducts();

        } catch (fallbackError) {
            console.error(fallbackError);

            $("#productGrid").innerHTML =
                '<p class="empty-state">Không tải được dữ liệu sản phẩm.</p>';
        }
    }
}

function renderSkeletons() {
    $("#productGrid").innerHTML =
        Array.from({ length: 6 }, () =>
            '<div class="skeleton"></div>'
        ).join("");
}

function productsToXML(items) {
    const doc = document.implementation.createDocument(
        "",
        "products",
        null
    );

    const root = doc.documentElement;

    items.forEach(product => {
        const node = doc.createElement("product");

        Object.entries(product).forEach(([key, value]) => {
            const child = doc.createElement(key);
            child.textContent = String(value);
            node.appendChild(child);
        });

        root.appendChild(node);
    });

    const serializer = new XMLSerializer();

    return serializer.serializeToString(doc);
}

function parseProductsXML(xmlText) {
    const doc = new DOMParser().parseFromString(
        xmlText,
        "application/xml"
    );

    if (doc.querySelector("parsererror")) {
        throw new Error("XML không hợp lệ");
    }

    return [...doc.querySelectorAll("product")].map(node => {
        const get = key =>
            node.querySelector(key)?.textContent ?? "";

        return {
            id: Number(get("id")),
            title: get("title"),
            price: Number(get("price")),
            description: get("description"),
            category: get("category"),
            image: get("image"),
            rating: Number(get("rating")),
            ratingCount: Number(get("ratingCount")),
            color: get("color"),
            stock: Number(get("stock")),
            variant: get("variant")
        };
    });
}

function downloadFile(name, content, type) {
    const blob = new Blob(
        [content],
        { type: `${type};charset=utf-8` }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = name;
    a.click();

    URL.revokeObjectURL(url);
}

function renderCategories() {
    const select = $("#categoryFilter");
    const selected = select.value;

    const categories = [
        ...new Set(products.map(p => p.category))
    ];

    select.innerHTML =
        '<option value="">Tất cả danh mục</option>' +
        categories.map(c =>
            `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`
        ).join("");

    select.value = selected;
}

function getFilteredProducts() {
    const term = $("#searchInput").value.trim().toLowerCase();
    const category = $("#categoryFilter").value;
    const color = $("#colorFilter").value;

    const min = Number($("#minPrice").value) || 0;
    const max = Number($("#maxPrice").value) || Infinity;
    const rating = Number($("#ratingFilter").value) || 0;

    let list = products.filter(p =>
        (!term ||
            `${p.title} ${p.description} ${p.category}`
                .toLowerCase().includes(term)
        ) &&
        (!category || p.category === category) &&
        (!color || p.color === color) &&
        p.price >= min &&
        p.price <= max &&
        p.rating >= rating
    );

    const sort = $("#sortSelect").value;

    if (sort === "price-asc") {
        list.sort((a, b) => a.price - b.price);
    }

    if (sort === "price-desc") {
        list.sort((a, b) => b.price - a.price);
    }

    if (sort === "rating-desc") {
        list.sort((a, b) => b.rating - a.rating);
    }

    return list;
}

function renderProducts() {
    const list = getFilteredProducts();

    $("#resultCount").textContent =
        `${list.length} sản phẩm`;

    $("#emptyState").hidden = list.length !== 0;

    $("#productGrid").innerHTML = list.map(p => `
        <article class="product-card"
            data-product-id="${p.id}">

            <div class="product-image-wrap">
                <span class="stock-tag">
                    ${p.stock > 0 ? `Còn ${p.stock}` : "Hết hàng"}
                </span>

                <img
                    class="product-image"
                    src="${escapeHTML(p.image)}"
                    alt="${escapeHTML(p.title)}"
                    loading="lazy"
                >
            </div>

            <div class="product-info">
                <span class="product-category">
                    ${escapeHTML(p.category)}
                </span>

                <h3 class="product-title">
                    ${escapeHTML(p.title)}
                </h3>

                <div class="product-meta">
                    <span class="rating-detail">
                        ★ ${p.rating.toFixed(1)}
                        (${p.ratingCount})
                    </span>

                    <span>${escapeHTML(p.color)}</span>
                </div>

                <p class="product-price">
                    ${money(p.price)}
                </p>

                <div class="product-actions">
                    <button
                        class="add-button"
                        data-action="add"
                        data-id="${p.id}"
                        ${p.stock <= 0 ? "disabled" : ""}
                    >
                        Thêm vào giỏ
                    </button>

                    <button
                        class="quick-button"
                        data-action="quick"
                        data-id="${p.id}"
                    >
                        Xem nhanh
                    </button>
                </div>
            </div>
        </article>
    `).join("");
}

function productById(id) {
    return products.find(p => p.id === Number(id));
}

function addToCart(id) {
    const p = productById(id);

    if (!p || p.stock <= 0) return;

    const line = cart[id] || {
        id: Number(id),
        quantity: 0
    };

    if (line.quantity >= p.stock) {
        alert("Số lượng trong giỏ đã đạt tồn kho.");
        return;
    }

    line.quantity++;

    cart[id] = line;

    writeStorage("hza_cart", cart);

    renderCart();
}

function renderCart() {
    const lines = Object.values(cart)
        .filter(x => x.quantity > 0);

    const count = lines.reduce(
        (n, x) => n + x.quantity, 0
    );

    const subtotal = lines.reduce((sum, line) => {
        const p = productById(line.id);
        return sum + (p?.price || 0) * line.quantity;
    }, 0);

    $("#cartCount").textContent = count;
    $("#cartSubtotal").textContent = money(subtotal);

    $("#cartItems").innerHTML = lines.length
        ? lines.map(line => {
            const p = productById(line.id);

            if (!p) return "";

            return `
                <div class="cart-line">
                    <img
                        src="${escapeHTML(p.image)}"
                        alt=""
                    >

                    <div>
                        <strong>
                            ${escapeHTML(p.title)}
                        </strong>

                        <small>${money(p.price)}</small>

                        <div class="qty-controls">
                            <button
                                data-action="qty-minus"
                                data-id="${p.id}"
                            >−</button>

                            <span>${line.quantity}</span>

                            <button
                                data-action="qty-plus"
                                data-id="${p.id}"
                            >+</button>
                        </div>
                    </div>

                    <button
                        class="remove-item"
                        data-action="remove"
                        data-id="${p.id}"
                    >
                        Xóa
                    </button>
                </div>
            `;
        }).join("")
        : '<p class="muted">Giỏ hàng đang trống.</p>';
}

function updateQuantity(id, delta) {
    const line = cart[id];
    const p = productById(id);

    if (!line || !p) return;

    line.quantity = Math.max(
        0,
        Math.min(p.stock, line.quantity + delta)
    );

    if (!line.quantity) {
        delete cart[id];
    }

    writeStorage("hza_cart", cart);

    renderCart();
}

function openDrawer() {
    $("#cartPanel").classList.add("open");
    $("#overlay").classList.add("show");
    $("#cartPanel").setAttribute("aria-hidden", "false");
}

function closeDrawer() {
    $("#cartPanel").classList.remove("open");
    $("#overlay").classList.remove("show");
    $("#cartPanel").setAttribute("aria-hidden", "true");
}

function showQuickView(id) {
    const p = productById(id);

    if (!p) return;

    const related = reviews.filter(
        r => r.productId === p.id
    );

    const average = averageReviews(p.id);

    $("#quickViewContent").innerHTML = `
        <div class="quick-view">
            <img
                src="${escapeHTML(p.image)}"
                alt="${escapeHTML(p.title)}"
            >

            <div>
                <span class="product-category">
                    ${escapeHTML(p.category)}
                </span>

                <h3>${escapeHTML(p.title)}</h3>

                <p class="rating-detail">
                    ★ ${(average || p.rating).toFixed(1)} / 5
                </p>

                <p>${escapeHTML(p.description)}</p>

                <p>
                    <b>Màu:</b> ${escapeHTML(p.color)}
                    ·
                    <b>Tồn kho:</b> ${p.stock}
                </p>

                <p class="product-price">
                    ${money(p.price)}
                </p>

                <button
                    class="primary-button"
                    data-action="add"
                    data-id="${p.id}"
                >
                    Thêm vào giỏ
                </button>

                <h4>Đánh giá chi tiết</h4>

                <div class="review-list">
                    ${related.length
                        ? related.map(r => `
                            <p>
                                <b>${escapeHTML(r.customer)}</b>
                                · ${r.rating}/5:
                                ${escapeHTML(r.comment)}
                            </p>
                        `).join("")
                        : "Chưa có đánh giá chi tiết."
                    }
                </div>
            </div>
        </div>
    `;

    $("#quickViewDialog").showModal();
}

async function loadReviews() {
    try {
        const response = await fetch(DATA.reviews);
        const xml = await response.text();

        const doc = new DOMParser().parseFromString(
            xml,
            "application/xml"
        );

        reviews = [
            ...doc.querySelectorAll("review")
        ].map(n => ({
            productId: Number(
                n.querySelector("product_id")?.textContent
            ),

            customer:
                n.querySelector("customer")?.textContent ||
                "Khách hàng",

            rating: Number(
                n.querySelector("rating")?.textContent
            ),

            comment:
                n.querySelector("comment")?.textContent || ""
        }));

    } catch {
        reviews = [];
    }
}

function averageReviews(productId) {
    const rows = reviews.filter(
        r => r.productId === Number(productId)
    );

    return rows.length
        ? rows.reduce((s, r) => s + r.rating, 0) / rows.length
        : 0;
}

function openLogin() {
    $("#loginMessage").textContent = "";
    $("#loginDialog").showModal();
}

async function login(event) {
    event.preventDefault();

    const email = $("#loginEmail")
        .value.trim().toLowerCase();

    const password = $("#loginPassword").value;

    try {
        const [empRes, custRes] = await Promise.all([
            fetch(DATA.employees),
            fetch(DATA.customers)
        ]);

        const [employees, customers] = await Promise.all([
            empRes.json(),
            custRes.json()
        ]);

        const user = [
            ...employees.map(x => ({
                ...x,
                role: "admin"
            })),

            ...customers.map(x => ({
                ...x,
                role: "customer"
            }))
        ].find(x =>
            x.email.toLowerCase() === email &&
            x.password === password
        );

        if (!user) {
            $("#loginMessage").textContent =
                "Email hoặc mật khẩu không đúng.";

            $("#loginMessage").className =
                "form-message error";

            return;
        }

        currentUser = {
            name: user.name,
            email: user.email,
            role: user.role
        };

        writeStorage("hza_user", currentUser);

        $("#loginDialog").close();

        $("#loginOpen").textContent = user.name;

        $("#adminOpen").classList.toggle(
            "hidden",
            user.role !== "admin"
        );

        if (user.role === "admin") {
            openAdmin();
        }

    } catch {
        $("#loginMessage").textContent =
            "Không đọc được dữ liệu tài khoản.";
    }
}

function openAdmin() {
    if (currentUser?.role !== "admin") {
        openLogin();
        return;
    }

    $("#adminUser").textContent =
        `Xin chào, ${currentUser.name}`;

    const orders = readStorage("hza_orders", []);

    const revenue = orders.reduce(
        (s, o) => s + o.total, 0
    );

    $("#adminContent").innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <span>Tổng sản phẩm</span>
                <strong>${products.length}</strong>
            </div>

            <div class="stat-card">
                <span>Đơn hàng</span>
                <strong>${orders.length}</strong>
            </div>

            <div class="stat-card">
                <span>Doanh thu</span>
                <strong>${money(revenue)}</strong>
            </div>
        </div>

        <h3>Danh sách đơn hàng</h3>

        ${orders.length
            ? `
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Mã đơn</th>
                            <th>Khách hàng</th>
                            <th>Ngày</th>
                            <th>Tổng tiền</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${orders.map(o => `
                            <tr>
                                <td>${escapeHTML(o.id)}</td>
                                <td>${escapeHTML(o.customer.name)}</td>
                                <td>
                                    ${new Date(o.createdAt)
                                        .toLocaleDateString("vi-VN")}
                                </td>
                                <td>${money(o.total)}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            `
            : '<p class="muted">Chưa có đơn hàng.</p>'
        }

        <h3>Thống kê sản phẩm theo danh mục</h3>

        <table class="admin-table">
            <thead>
                <tr>
                    <th>Danh mục</th>
                    <th>Số sản phẩm</th>
                    <th>Tồn kho</th>
                </tr>
            </thead>

            <tbody>
                ${[...new Set(products.map(p => p.category))]
                    .map(c => {
                        const rows = products.filter(
                            p => p.category === c
                        );

                        return `
                            <tr>
                                <td>${escapeHTML(c)}</td>
                                <td>${rows.length}</td>
                                <td>
                                    ${rows.reduce(
                                        (s, p) => s + p.stock, 0
                                    )}
                                </td>
                            </tr>
                        `;
                    }).join("")
                }
            </tbody>
        </table>
    `;

    $("#adminDialog").showModal();
}

function validateField(field) {
    const value = field.value.trim();

    const valid = field.id === "checkoutPhone"
        ? /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/
            .test(value.replace(/\s/g, ""))
        : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
            .test(value);

    field.setCustomValidity(
        value && !valid
            ? field.id === "checkoutPhone"
                ? "Nhập số điện thoại Việt Nam hợp lệ."
                : "Nhập email hợp lệ."
            : ""
    );

    return valid;
}

function validateCheckout() {
    const phoneValid =
        validateField($("#checkoutPhone"));

    const emailValid =
        validateField($("#checkoutEmail"));

    return {
        phoneValid,
        emailValid
    };
}

function submitOrder(event) {
    event.preventDefault();

    const lines = Object.values(cart);
    const message = $("#checkoutMessage");

    message.className = "form-message";

    if (!lines.length) {
        message.textContent = "Giỏ hàng đang trống.";
        message.classList.add("error");
        return;
    }

    const {
        phoneValid,
        emailValid
    } = validateCheckout();

    if (!event.currentTarget.reportValidity()) {
        return;
    }

    if (!phoneValid || !emailValid) {
        message.textContent =
            "Số điện thoại hoặc email chưa đúng định dạng.";

        message.classList.add("error");
        return;
    }

    for (const line of lines) {
        const p = productById(line.id);

        if (!p || line.quantity > p.stock) {
            message.textContent =
                "Sản phẩm không đủ tồn kho.";

            message.classList.add("error");
            return;
        }
    }

    const customer = {
        name: $("#checkoutName").value.trim(),
        email: $("#checkoutEmail").value.trim(),
        phone: $("#checkoutPhone").value.trim(),
        address: $("#checkoutAddress").value.trim(),
        note: $("#checkoutNote").value.trim()
    };

    const total = lines.reduce(
        (s, l) => s + productById(l.id).price * l.quantity,
        0
    );

    const order = {
        id: "BW" + Date.now(),
        createdAt: new Date().toISOString(),
        customer,

        items: lines.map(l => ({
            productId: l.id,
            title: productById(l.id).title,
            quantity: l.quantity,
            price: productById(l.id).price
        })),

        total
    };

    const orders = readStorage("hza_orders", []);

    orders.push(order);

    writeStorage("hza_orders", orders);

    lines.forEach(l => {
        const p = productById(l.id);
        p.stock -= l.quantity;
    });

    saveProductsXML(productsToXML(products));

    cart = {};

    writeStorage("hza_cart", cart);

    renderCart();
    renderProducts();

    $("#checkoutForm").reset();

    message.textContent = "";

    $("#checkoutDialog").close();

    closeDrawer();

    alert(
        `Đặt hàng thành công.
Mã đơn: ${order.id}
Tổng thanh toán: ${money(total)}`
    );
}

function loadUser() {
    currentUser = readStorage("hza_user", null);

    if (currentUser) {
        $("#loginOpen").textContent =
            currentUser.name;

        $("#adminOpen").classList.toggle(
            "hidden",
            currentUser.role !== "admin"
        );

    } else {
        $("#adminOpen").classList.add("hidden");
    }
}

function bindEvents() {

    $("#productGrid").addEventListener("click", event => {
        const button = event.target.closest("[data-action]");

        if (!button) return;

        const id = button.dataset.id;

        if (button.dataset.action === "add") {
            addToCart(id);
        }

        if (button.dataset.action === "quick") {
            showQuickView(id);
        }
    });

    $("#cartItems").addEventListener("click", event => {
        const button = event.target.closest("[data-action]");

        if (!button) return;

        const id = button.dataset.id;

        if (button.dataset.action === "qty-plus") {
            updateQuantity(id, 1);
        }

        if (button.dataset.action === "qty-minus") {
            updateQuantity(id, -1);
        }

        if (button.dataset.action === "remove") {
            delete cart[id];

            writeStorage("hza_cart", cart);

            renderCart();
        }
    });

    $("#quickViewContent").addEventListener("click", event => {
        const button = event.target.closest(
            '[data-action="add"]'
        );

        if (button) {
            addToCart(button.dataset.id);
            $("#quickViewDialog").close();
        }
    });

    $("#searchForm").addEventListener("submit", event => {
        event.preventDefault();
        renderProducts();
    });

    $("#searchInput").addEventListener(
        "input",
        renderProducts
    );

    $("#filterForm").addEventListener("submit", event => {
        event.preventDefault();
        renderProducts();
    });

    $("#resetFilters").addEventListener("click", () => {
        $("#filterForm").reset();
        renderProducts();
    });

    $("#sortSelect").addEventListener(
        "change",
        renderProducts
    );

    $("#cartToggle").addEventListener(
        "click",
        openDrawer
    );

    $("#overlay").addEventListener(
        "click",
        closeDrawer
    );

    $("#loginOpen").addEventListener(
        "click",
        openLogin
    );

    $("#adminOpen").addEventListener(
        "click",
        openAdmin
    );

    $("#loginForm").addEventListener(
        "submit",
        login
    );

    $("#checkoutOpen").addEventListener("click", () => {
        if (!Object.keys(cart).length) {
            alert("Giỏ hàng đang trống.");
            return;
        }

        if (currentUser?.role === "customer") {
            $("#checkoutName").value = currentUser.name;
            $("#checkoutEmail").value = currentUser.email;
        }

        closeDrawer();

        $("#checkoutDialog").showModal();
    });

    $("#checkoutForm").addEventListener(
        "submit",
        submitOrder
    );

    ["checkoutPhone", "checkoutEmail"].forEach(id => {
        const field = $("#" + id);

        field.addEventListener("keyup", () => {
            validateField(field);
        });

        field.addEventListener("blur", () => {
            validateField(field);
        });
    });

    document.addEventListener("click", event => {
        const close = event.target.closest("[data-close]");

        if (close) {
            closeDrawer();
        }

        const dialogClose = event.target.closest(
            "[data-close-dialog]"
        );

        if (dialogClose) {
            $("#" + dialogClose.dataset.closeDialog).close();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeDrawer();
        }
    });
}

async function init() {
    cart = readStorage("hza_cart", {});

    bindEvents();

    loadUser();

    renderCart();

    await Promise.all([
        loadReviews(),
        loadProducts()
    ]);
}

document.addEventListener(
    "DOMContentLoaded",
    init
);