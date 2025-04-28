let nextPage = 0;
let isLoading = false;
let currentKeyword = null; 

const attractionID = window.location.pathname.split("/").pop();

document.addEventListener("DOMContentLoaded", () => {
    loadMRTs();
    setupListbarScroll();
    setupSearchEvents();
    setupLoginDialogue();
    checkAuthStatus();

    const token = localStorage.getItem("token");
    const isAttractionPage = window.location.pathname.startsWith("/attraction");
    const isBookingPage = window.location.pathname.startsWith("/booking");
    const isThankyouPage = window.location.pathname.startsWith("/thankyou");
    const isMemberPage = window.location.pathname.startsWith("/member");

    if (isAttractionPage) {
        fetchAttractionID();
    } else if (isBookingPage || isThankyouPage || isMemberPage) {
        if (!token) {
            document.querySelector("footer")?.classList.add("no-booking");
            setTimeout(() => {
                document.querySelector(".login")?.click();
            }, 0);
            return;
        }

        if (isBookingPage) {
            handleBookingPage();
        } else if (isThankyouPage) {
            handleThankyouPage();
        } else if (isMemberPage) {
            handleMemberPage();
        }
    } else {
        fetchAttractions();
    }
});

const sentinel = document.querySelector(".sentinel");
const sentinelObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            fetchAttractions();
        }
    });
}, { rootMargin: "300px" });
if (sentinel) {
    sentinelObserver.observe(sentinel);
}

async function loadMRTs() {
    try {
        const response = await fetch("/api/mrts");
        const data = await response.json();
        const listbar = document.querySelector(".listbar .container");
        if (!listbar || !data.data) return;

        data.data.forEach(mrt => {
            const p = document.createElement("p");
            p.textContent = mrt;
            p.classList.add("mrt-item");
            listbar.appendChild(p);
        });
    } catch (error) {
        console.error(error);
    }
}

function setupListbarScroll() {
    const listbarContainer = document.querySelector(".listbar .container");
    const leftButton = document.querySelector(".listbar .left img");
    const rightButton = document.querySelector(".listbar .right img");
    if (!listbarContainer || !leftButton || !rightButton) return;

    const scrollAmount = 250;
    leftButton.addEventListener("click", () => {
        listbarContainer.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    });
    rightButton.addEventListener("click", () => {
        listbarContainer.scrollBy({ left: scrollAmount, behavior: "smooth" });
    });
}

async function fetchAttractions() {
    if (isLoading) return;
    isLoading = true;

    try {
        const url = currentKeyword
            ? `/api/attractions?page=${nextPage}&keyword=${encodeURIComponent(currentKeyword)}`
            : `/api/attractions?page=${nextPage}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!data.data || data.data.length === 0) {
            sentinelObserver.unobserve(sentinel);
            return;
        }

        const favoriteIds = await getFavoriteIds();

        loadCard(data.data, favoriteIds);

        nextPage = data.nextPage ?? (nextPage + 1);
    } catch (error) {
        console.error("⚠️ Fetch Attractions Error:", error);
    } finally {
        isLoading = false;
        hideLoading();
    }
}

async function getFavoriteIds() {
    const token = localStorage.getItem("token");
    if (!token) return [];
  
    try {
      const res    = await fetch("/api/favorite", { headers: { Authorization: `Bearer ${token}` } });
      const result = await res.json();
      return extractFavoriteIds(result.data);
    } catch (err) {
      console.warn("❌ 無法取得 favorite 列表", err);
      return [];
    }
  }

function loadCard(attractions, favoriteIds = []) {
    const bigBox = document.querySelector(".big-box");
    if (!bigBox) return;

    const sentinel = document.querySelector(".sentinel");

    attractions.forEach((item) => {
        const cardLink = document.createElement("a");
        cardLink.classList.add("card-frame");
        cardLink.href = `/attraction/${item.id}`;

        const card = document.createElement("div");
        card.classList.add("card");

        let heartBtn = null;
        if (localStorage.getItem("token")) {
            heartBtn = document.createElement("div");
            heartBtn.classList.add("heart-btn");
            heartBtn.dataset.id = item.id;               
        if (favoriteIds.includes(item.id)) heartBtn.classList.add("active");
            card.appendChild(heartBtn);                  
        }


        const img = document.createElement("img");
        img.src = item.images?.[0] || "./static/img/placeholder.jpg";
        img.alt = item.name;

        const title = document.createElement("h2");
        title.textContent = item.name;

        card.appendChild(img);
        card.appendChild(title);

        const cardCategory = document.createElement("div");
        cardCategory.classList.add("card_category");

        const mrt = document.createElement("p");
        mrt.textContent = item.mrt || "無捷運站";

        const category = document.createElement("p");
        category.textContent = item.category;

        cardCategory.appendChild(mrt);
        cardCategory.appendChild(category);
        
        cardLink.appendChild(card);         
        cardLink.appendChild(cardCategory); 

        bigBox.insertBefore(cardLink, sentinel);
    });

    setupFavorite();
}

function setupSearchEvents() {
    const searchBtn = document.querySelector("button.搜尋");
    const searchInput = document.querySelector("input.景點名稱");
    const listbarContainer = document.querySelector(".listbar .container");
    if (!searchBtn || !searchInput || !listbarContainer) return;

    searchBtn.addEventListener("click", handleSearch);
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleSearch();
    });
    listbarContainer.addEventListener("click", (e) => {
        if (e.target.matches(".mrt-item")) {
            searchInput.value = e.target.textContent;
            handleSearch();
        }
    });

    function handleSearch() {
        const keyword = searchInput.value.trim();
        clearBigBox();

        if (!keyword) {
            resetAndFetch();
        } else {
            currentKeyword = keyword;
            nextPage = 0;
            sentinelObserver.observe(sentinel);
            fetchAttractions();
        }
    }

    function clearBigBox() {
        sentinelObserver.unobserve(sentinel);
        document.querySelectorAll(".big-box .card-frame").forEach(el => {
            if (!el.classList.contains("sentinel")) el.remove();
        });
    }
}

function hideLoading() {
    document.querySelectorAll(".big-box .loading-card").forEach(el => el.remove());
}

function resetAndFetch() {
    currentKeyword = null;
    nextPage = 0;
    sentinelObserver.observe(sentinel);
    fetchAttractions();
}

async function fetchAttractionID() {
    if (isLoading) return;
    isLoading = true;

    try {
        const url = `/api/attraction/${attractionID}`;
        const response = await fetch(url);
        const data = await response.json();

        loadAttractions(data.data);
    } catch (error) {
        console.error("⚠️ Fetch AttractionID Error:", error);
    } finally {
        isLoading = false;
        hideLoading();
    }
}

function loadAttractions(attraction) {
    const attractionContainer = document.querySelector(".attraction_container_1");
    const container2 = document.querySelector(".container2");
    if (!attractionContainer || !container2) return;

    const carousel = document.createElement("div");
    carousel.className = "attraction_carousel";

    const allBtnContainer = document.createElement("div");
    allBtnContainer.className = "all_btn_container";

    const leftBtn = document.createElement("div");
    leftBtn.className = "btn_container";
    leftBtn.innerHTML = `<img src="/static/img/icon/arrow left.svg">`;

    const rightBtn = document.createElement("div");
    rightBtn.className = "btn_container";
    rightBtn.innerHTML = `<img src="/static/img/icon/arrow right.svg">`;

    allBtnContainer.appendChild(leftBtn);
    allBtnContainer.appendChild(rightBtn);
    carousel.appendChild(allBtnContainer);

    const token = localStorage.getItem("token");
    if (token) {
      const heartBtn = document.createElement("div");
      heartBtn.classList.add("heart-btn");
      heartBtn.dataset.id = attraction.id;
      
      heartBtn.style.cssText = "position:absolute;top:10px;right:10px;z-index:10";
      allBtnContainer.appendChild(heartBtn);
    }

    
    const slider = document.createElement("div");
    slider.className = "slider";

    attraction.images.forEach(imgSrc => {
        const img = document.createElement("img");
        img.src = imgSrc;
        img.onerror = () => {
            img.setAttribute("data-ignore", "true");
            img.remove();
        };
        slider.appendChild(img);
    });

    carousel.appendChild(slider);
    attractionContainer.appendChild(carousel);

    const bookingDiv = document.createElement("div");
    bookingDiv.className = "attraction_container_booking";
    bookingDiv.innerHTML = `
        <h2>${attraction.name}</h2>
        <div class="attraction_category">
            <p class="category">${attraction.category}</p><p>&nbsp;at&nbsp;</p><p class="mrt">${attraction.mrt}</p>
        </div>
        <div class="attraction_board">
            <h3>訂購導覽行程</h3>
            <p>以此景點為中心的一日行程，帶您探索城市角落故事</p>
            <div class="input-group">
                <h3>選擇日期：</h3>
                <input type="date">
            </div>
            <div class="input-group">
                <h3>選擇時間：</h3>
                <label class="custom-radio">
                <input type="radio" name="time" value="上半天" checked/>
                <span class="radio-mark"></span>
                <span class="radio-label"><span class="radio-text">上半天</span></span>
                </label>
                <label class="custom-radio">
                <input type="radio" name="time" value="下半天" />
                <span class="radio-mark"></span>
                <span class="radio-label"><span class="radio-text">下半天</span></span>
                </label>
            </div>
            <div class="input-group">
                <h3>導覽費用：</h3><p>新台幣</p><p class="tour-price">--</p><p>元</p>
            </div>
            <button class="book">開始預約行程</button>
        </div>
    `;
    attractionContainer.appendChild(bookingDiv);

    setupHeartBtn();

    const tourPriceP = bookingDiv.querySelector(".tour-price");
    tourPriceP.textContent = '2000';

    const timeRadios = bookingDiv.querySelectorAll('input[name="time"]');
    timeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            tourPriceP.textContent = radio.value === '上半天' ? '2000' : '2500';
        });
    });

    const bookBtn = bookingDiv.querySelector(".book");
    console.log("book btn綁定", bookBtn);

    bookBtn.addEventListener("click", async () => {
        const dateInput = bookingDiv.querySelector("input[type='date']");
        const selectDate = dateInput.value;
        const selectTime = bookingDiv.querySelector("input[name='time']:checked")?.value;
        const price = parseInt(tourPriceP.textContent);
        const attractionId = parseInt(attraction.id);  

        const token = localStorage.getItem("token");
        if (!token) {

            localStorage.setItem("pendingBooking", JSON.stringify({
                attractionId,
                selectDate,
                selectTime,
                price}));

            document.querySelector(".login_dialogue").classList.add("active");
            document.querySelector(".mask").classList.add("active");
            return;
        }

        if (!selectDate || !selectTime || !price || !attractionId) {
            alert("您的預定行程資訊未填寫完整");
            return;
        }

        try {
            const res = await fetch("/api/booking", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    price,
                    attractionId,
                    date: selectDate,
                    time: selectTime === "上半天" ? "morning" : "afternoon",
                })
            });

            const data = await res.json();
            if (res.ok && data.ok) {
                window.location.href = "/booking";
            } else {
                alert(data.message || "預約失敗，請重新預約");
            }
        } 
        catch (error) {
            console.error("發生了問題", error);
            alert("伺服器發生錯誤，請稍後再試");
        }
    });

    const intro = document.querySelector(".attraction_intro");
    const address = document.querySelector(".attraction_address");
    const mrt = document.querySelector(".attraction_mrt");

    intro.textContent = attraction.description;
    address.innerHTML += attraction.address;
    mrt.innerHTML += attraction.transport;

    setupCarousel();
    setupAttractionHeartBtn(Number(attraction.id));   
}

function setupCarousel () {
    
    const slider = document.querySelector(".slider");
    if (!slider) return;
  
    const arrows = [...document.querySelectorAll(".all_btn_container .btn_container img")];
    if (arrows.length < 2) {
      console.warn("找不到左右箭頭 img，實際找到：", arrows.length);
      return;
    }
    const [leftBtn, rightBtn] = arrows;
  
    const imgs = slider.querySelectorAll("img:not([data-ignore])");
    const total = imgs.length;
    if (total === 0) return;
  
    
    const state = { idx: 0 };
    const proxy = new Proxy(state, {
      set (o, p, v){
        if (p === "idx" && v >= 0 && v < total){
          o[p] = v;
          slider.scrollTo({         
            left: v * slider.clientWidth,
            behavior: "smooth"
          });
          updateDots(v);
        }
        return true;
      }
    });
  
    
    const dotWrap  = document.createElement("div");
    dotWrap.className = "carousel-dots-wrapper";
    const dotsBox  = document.createElement("div");
    dotsBox.className = "carousel-dots";
    dotWrap.appendChild(dotsBox);
    slider.parentElement.appendChild(dotWrap);
  
    const dots = [];
    for (let i = 0; i < total; i++){
      const d = document.createElement("img");
      d.src = i === 0
        ? "/static/img/icon/Union.png"
        : "/static/img/icon/circle default 1.png";
      d.onclick = () => { proxy.idx = i; };
      dotsBox.appendChild(d);
      dots.push(d);
    }
  
    function updateDots(cur){
      dots.forEach((d,i)=>{
        d.src = i === cur
          ? "/static/img/icon/Union.png"
          : "/static/img/icon/circle default 1.png";
      });
    }
  
    
    leftBtn .onclick = () => { proxy.idx--; };
    rightBtn.onclick = () => { proxy.idx++; };
  
    
    let resizeT;
    window.addEventListener("resize", () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(()=>{
        slider.scrollLeft = proxy.idx * slider.clientWidth;
      },150);
    });
  }

  function setupLoginDialogue() {
    const mask = document.querySelector(".mask");
    const login = document.querySelector(".login"); 
    const loginDialogue = document.querySelector(".login_dialogue");
    const closeBtn = document.querySelector(".close img");
    const switchToSignup = document.querySelector(".switch-to-signup");
    const switchToLogin = document.querySelector(".switch-to-login");
    const formLogin = document.querySelector(".form.login_elements");
    const formSignup = document.querySelector(".form.signup_elements");
    const logoutBtn = document.querySelector(".logout");

    
    login.addEventListener("click", (e) => {
        e.preventDefault();
        mask.classList.add("active");
        loginDialogue.classList.add("active");
    });

    closeBtn.addEventListener("click", closeLoginDialog);
    mask.addEventListener("click", closeLoginDialog);

    function closeLoginDialog() {
        mask.classList.remove("active");
        loginDialogue.classList.remove("active");
    }

    switchToSignup.addEventListener("click", () => {
        formLogin.classList.remove("active");
        formSignup.classList.add("active");
    });

    switchToLogin.addEventListener("click", () => {
        formSignup.classList.remove("active");
        formLogin.classList.add("active");
    });

    document.querySelector(".signin-btn")?.addEventListener("click", (e) => {
        e.preventDefault();
        signin();
    });

    document.querySelector(".signup-btn")?.addEventListener("click", (e) => {
        e.preventDefault();
        signup();
    });

    logoutBtn?.addEventListener("click", () => {
        logout("manual");
    });
}


async function signin() {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();
    const errorDiv = document.getElementById("login-error");
    errorDiv.textContent = "";

    if (!email || !password) {
        errorDiv.textContent = "請填寫帳號與密碼";
        return;
    }

    try {
        const res = await fetch("/api/user/auth", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (!res.ok) {
            errorDiv.textContent = data.message || "登入失敗";
            return;
        }

        const token = data.token;
        localStorage.setItem("token", token);

        const verifyRes = await fetch("/api/user/auth", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const verifyData = await verifyRes.json();
        if (verifyRes.ok) {
            
            const pendingBooking = JSON.parse(localStorage.getItem("pendingBooking"));
            if (pendingBooking && window.location.pathname.startsWith("/attraction/")) {
                localStorage.setItem("restoreBooking", JSON.stringify(pendingBooking));
                localStorage.removeItem("pendingBooking");
            }

            document.querySelector(".login_dialogue").classList.remove("active");
            document.querySelector(".mask").classList.remove("active");

            window.location.reload(); 
        } else {
            console.error("登入驗證失敗：", verifyData);
            errorDiv.textContent = "登入驗證失敗，請稍後再試";
        }

    } catch (err) {
        console.error("登入錯誤", err);
        errorDiv.textContent = "登入過程發生錯誤";
    }
}

async function signup() {
    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();  
    const password = document.getElementById("signup-password").value.trim();

    const errorDiv = document.getElementById("signup-error");
    errorDiv.textContent = "";

    console.log("email欄位綁定", email);

    if (!name || !email || !password) {
        errorDiv.textContent = "請填寫姓名、帳號與密碼";
        return;
    }

    try {
        const res = await fetch("/api/user", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();
        if (!res.ok) {
            errorDiv.textContent = "註冊失敗";
            return;
        }
        alert("註冊成功！");
        window.location.reload();
        } catch (err) {
        console.error("註冊錯誤", err);
        errorDiv.textContent = "註冊過程發生錯誤";
    }
}

async function checkAuthStatus() {
    const token = localStorage.getItem("token");
    const loginBtn = document.querySelector(".login");
    const logoutBtn = document.querySelector(".logout");

    if (!loginBtn || !logoutBtn) return;

    if (!token) {
        loginBtn.style.display = "flex";
        logoutBtn.style.display = "none";
    }

    try {
        const res = await fetch("/api/user/auth", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await res.json();

        if (res.ok && data.data) {
            loginBtn.style.display = "none";
            logoutBtn.style.display = "flex";
        } else {
            localStorage.removeItem("token");
            loginBtn.style.display = "flex";
            logoutBtn.style.display = "none";
        }
    } catch (error) {
        console.error("checkAuthStatus有誤", error);
        localStorage.removeItem("token");
        loginBtn.style.display = "flex";
        logoutBtn.style.display = "none";
    }
}

function logout(reason = "manual") {
    localStorage.removeItem("token");
    if (reason === "manual") {
        alert("已成功登出！");
    } else if (reason === "expired") {
        alert("登入已過期，請重新登入。");
    }
    window.location.reload();
}

async function fetchBooking() {
    const token = localStorage.getItem("token");
    if (!token) return;

    const bookingContainer = document.querySelector(".booking_container");

    try {
        const res = await fetch("/api/booking", {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();

        if (!res.ok || !result.data) {
            bookingContainer.innerHTML = `<h3>目前沒有任何待預定的行程</h3>`;
            document.querySelector("footer")?.classList.add("no-booking");
            return;
        }


        const { attraction, date, time, price } = result.data;

        const bookingDiv = document.createElement("div");
        bookingDiv.className = "booking_container_attraction";
        bookingDiv.innerHTML = `
            <img src="${attraction.image}" alt="${attraction.name}">
            <div class="info">
                <h2>台北一日遊：${attraction.name}</h2>
                <div class="date"><strong>日期：</strong><span class="normal">${date}</span></div>
                <div class="time"><strong>時間：</strong><span class="normal">${time === "morning" ? "上半天" : "下半天"}</span></div>
                <div class="price"><strong>費用：</strong><span class="normal">新台幣 ${price} 元</span></div>
                <div class="address"><strong>地點：</strong><span class="normal">${attraction.address}</span></div>
                <img class="delete" src="/static/img/icon/delete.png">
                </div>
            </div>
        `;

        bookingContainer.appendChild(bookingDiv);


        const style = document.createElement("style");
        style.textContent = `
        .page-booking .input-group {
        display: flex;
        align-items: center;
        }
        .page-booking .input-group label {
        width: 81px;
        }
        .tpfield {
        border-radius: 5px;
        border: 1px solid #CCCCCC;
        height: 18px;
        padding: 10px;
        width: 200px;
        box-shadow: none;
        outline: none;
        }
        `;
        document.head.appendChild(style);

const payHtml =  `
  <div class="contract">
    <div class="contract_form">
      <h2>您的預定資訊</h2>
      <div class="input-group"><label>聯絡姓名：</label><input id="contract-name" type="text"></div>
      <div class="input-group"><label>聯絡信箱：</label><input id="contract-email" type="email"></div>
      <div class="input-group"><label>手機號碼：</label><input id="contract-phone" type="tel"></div>
      <p class="field-notice">請保持手機暢通，準時到達，導覽人員將用手機與您聯繫，務必留下正確的聯絡方式。</p>
    </div>
  </div>

  <div class="payment">
    <div class="payment_form">
      <h2>信用卡付款資訊</h2>
      <div class="input-group"><label>卡片號碼：</label><div id="card-number" class="tpfield"></div></div>
      <div class="input-group"><label>過期時間：</label><div id="card-expiration-date" class="tpfield"></div></div>
      <div class="input-group"><label>驗證密碼：</label><div id="card-ccv" class="tpfield"></div></div>
    </div>
  </div>

  <div class="total"><h2>總價：<span id="total-price">${price}</span> 元</h2></div>
  <div class="checkout_btn"><button id="tappay-submit" disabled>確認訂購並付款</button></div>
`;

bookingContainer.insertAdjacentHTML('beforeend', payHtml);

requestAnimationFrame(initTapPay);

function initTapPay () {
  if (!window.TPDirect) { console.error('TapPay SDK 尚未載入'); return; }

  const numberEl = document.getElementById('card-number');
  const expEl    = document.getElementById('card-expiration-date');
  const ccvEl    = document.getElementById('card-ccv');
  const payBtn   = document.getElementById('tappay-submit');
  if (!numberEl || !expEl || !ccvEl || !payBtn) return;

  TPDirect.card.setup({
    fields: {
      number:         { element: numberEl, placeholder: '**** **** **** ****' },
      expirationDate: { element: expEl,    placeholder: 'MM / YY' },
      ccv:            { element: ccvEl,    placeholder: 'CVV' }
    },
    styles: {
      'input': {
        color: '#666',
        'font-size': '16px',
        'border-radius': '5px',
        'border': '1px solid #CCCCCC',
        'height': '38px',
        'padding': '10px',
        'box-shadow': 'none',
        'outline': 'none',
        'width': '200px'
      },
      ':focus':  {
        color: '#448899'
      },
      '.valid': {
        color: 'green'
      },
      '.invalid': {
        color: 'red'
      }
    },
    isMaskCreditCardNumber: true,
    maskCreditCardNumberRange: { beginIndex: 6, endIndex: 11 }
  });
  
  TPDirect.card.onUpdate(update => {
    update.canGetPrime ? payBtn.removeAttribute('disabled')
                       : payBtn.setAttribute('disabled', true);
  });
  
  payBtn.addEventListener('click', onPayClick);
}

function onPayClick (e) {
  e.preventDefault();

  const status = TPDirect.card.getTappayFieldsStatus();
  if (!status.canGetPrime) { alert('信用卡資訊不完整'); return; }

  TPDirect.card.getPrime(result => {
    if (result.status !== 0) { alert('取得 Prime 失敗：' + result.msg); return; }

    const prime   = result.card.prime;
    const contact = {
      name : document.getElementById('contract-name').value.trim(),
      email: document.getElementById('contract-email').value.trim(),
      phone: document.getElementById('contract-phone').value.trim()
    };

    if (!contact.name || !contact.email || !contact.phone) {
        alert('請填寫您的聯絡資訊');
        return;
    }

    fetch('/api/orders', {
      method : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization : `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        prime,
        order: { price, attractionId: attraction.id, date, time, contact }
      })
    })
    .then(r => r.json())
    .then(res => {
      if (res?.data?.number) {
        location.href = `/thankyou?number=${res.data.number}`;
      } else {
        alert('付款失敗：' + (res.message || '未知錯誤'));
      }
    })
    .catch(err => console.error('送 /api/orders 失敗', err));
  });
}

    } catch (error) {
        console.error("Fetch Booking Error:", error);
        document.querySelector("footer")?.classList.add("no-booking");
    }
}

document.addEventListener("click", (e) => {
    if (e.target.closest(".delete")) {
      if (!confirm("確定要刪除行程嗎？")) return;
  
      const token = localStorage.getItem("token");
      fetch("/api/booking", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          document.querySelector(".booking_container_attraction")?.remove();
          window.location.reload(); 
        } else {
          alert(data.message || "刪除失敗，請稍後再試");
        }
      })
      .catch(err => console.error("刪除行程失敗", err));
    }
  });

  async function fetchThankyou() {
    const token = localStorage.getItem("token");
    if (!token) return;
  
    const orderContainer = document.querySelector(".thankyou_container");
    const urlParams      = new URLSearchParams(window.location.search);
    const orderNumber    = urlParams.get("number");
  
    if (!orderNumber) {
      orderContainer.innerHTML = `<h3>查無訂單編號</h3>`;
      document.querySelector("footer")?.classList.add("no-booking");
      return;
    }
  
    try {
      const orderRes  = await fetch(`/api/order/${orderNumber}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const orderData = await orderRes.json();
  
      if (!orderRes.ok || !orderData.data) {
        orderContainer.innerHTML = `<h3>目前沒有任何已預定的行程</h3>`;
        document.querySelector("footer")?.classList.add("no-booking");
        return;
      }
  
      const orderDiv = document.createElement("div");
      orderDiv.className = "headline-container";
      orderDiv.innerHTML = `
        <h2>行程預定成功</h2>
        <h2>您的訂單編號如下</h2>
        <p>${orderNumber}</p>
        <p>請記住此編號，或到會員中心查看</p>
      `;
      orderContainer.appendChild(orderDiv);
      document.querySelector("footer")?.classList.add("no-booking");
  
    } catch (err) {
      console.error("加載失敗", err);
      alert("伺服器錯誤，請重新整理頁面");
    }
  }

async function handleBookingPage() {
    const token = localStorage.getItem("token");
    if (!token) {
        showLoginDialog();
        document.querySelector("footer")?.classList.add("no-booking");
        return;
    }

    try {
        const res = await fetch("/api/user/auth", {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok || !data.data || !data.data.name) {
            showLoginDialog();
            document.querySelector("footer")?.classList.add("no-booking");
            return;
        }

        const headlineEl = document.querySelector(".headline");
        if (headlineEl) {
            headlineEl.textContent = `您好，${data.data.name}，待預定的行程如下：`;
        }

        fetchBooking();

    } catch (err) {
        console.error("驗證失敗", err);
        showLoginDialog();
        document.querySelector("footer")?.classList.add("no-booking");
    }
}

async function handleThankyouPage() {
    const token = localStorage.getItem("token");
    if (!token) {
        showLoginDialog();
        document.querySelector("footer")?.classList.add("no-booking");
        return;
    }

    try {
        const res = await fetch("/api/user/auth", {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok || !data.data || !data.data.name) {
            showLoginDialog();
            document.querySelector("footer")?.classList.add("no-booking");
            return;
        }

        const headlineEl = document.querySelector(".headline");
        if (headlineEl) {
            headlineEl.textContent = ``;
        }

        fetchThankyou();

    } catch (err) {
        console.error("驗證失敗", err);
        showLoginDialog();
        document.querySelector("footer")?.classList.add("no-booking");
    }
}

async function handleMemberPage() {
    const token = localStorage.getItem("token");
    if (!token) {
        showLoginDialog();
        document.querySelector("footer")?.classList.add("no-booking");
        return;
    }

    try {
        const res = await fetch("/api/user/auth", {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok || !data.data || !data.data.name) {
            showLoginDialog();
            document.querySelector("footer")?.classList.add("no-booking");
            return;
        }

        fetchMember(data.data.name);

    } catch (err) {
        console.error("驗證失敗", err);
        showLoginDialog();
        document.querySelector("footer")?.classList.add("no-booking");
    }
}

async function fetchMember(userName) {
    const token = localStorage.getItem("token");
    if (!token) return;
  
    const memberContainer = document.querySelector(".member-container");
    if (!memberContainer) return;
  
    
    memberContainer.innerHTML = "";
  
    
    const functionDiv = document.createElement("div");
    functionDiv.className = "function-container";
    functionDiv.innerHTML = `
      <div class="profile">
          <img src="/static/img/icon/account-grey-icon.png" alt="profilepic">
          <h2 class="name">${userName}</h2>
      </div>
      <div class="two-functions">
      <div class="function function-orders"><img src="/static/img/icon/orders.svg" alt="訂單"><h2>我的訂單</h2></div>
      <div class="function function-favorite"><img src="/static/img/icon/favorite.svg" alt="最愛"><h2>我的最愛</h2></div>
      </div>
    `;
    memberContainer.appendChild(functionDiv);
  
    
    const contentDiv = document.createElement("div");
    contentDiv.className = "member-container-content";
    memberContainer.appendChild(contentDiv);
  
    
    setupMemberFunction();
    fetchOrder();          
    document.querySelector("footer")?.classList.add("no-booking");
  }
  
  
  function setupMemberFunction() {
    const btnOrders   = document.querySelector(".function-orders");
    const btnFavorite = document.querySelector(".function-favorite");
    const contentDiv  = document.querySelector(".member-container-content");
  
    if (!btnOrders || !btnFavorite || !contentDiv) {
      console.error("無法initialize會員功能切換元件");
      return;
    }
  
    btnOrders.addEventListener("click", () => {
      contentDiv.innerHTML = "";           
      btnOrders.classList.add("active");   
      btnFavorite.classList.remove("active");
      fetchOrder();
    });
  
    btnFavorite.addEventListener("click", () => {
      contentDiv.innerHTML = "";
      btnFavorite.classList.add("active");
      btnOrders.classList.remove("active");
      fetchFavorite();
    });
  }
  
  async function fetchOrder() {
    const token = localStorage.getItem("token");
    if (!token) return;
  
    const container = document.querySelector(".member-container-content");
    if (!container) return;
  
    container.innerHTML = "<p>Loading...</p>";
  
    try {
      const res    = await fetch("/api/member", { headers: { Authorization: `Bearer ${token}` } });
      const result = await res.json();
  
      container.innerHTML = "";   
  
      const orders = result.data;
      if (!res.ok || !orders || orders.length === 0) {
        container.innerHTML = `<h3>目前沒有任何已預定的行程</h3>`;
        return;
      }
  
      for (const order of orders) {
        const { price, trip } = order;
        const { attraction, date, time } = trip;
  
        const div = document.createElement("div");
        div.className = "booking_container_attraction";
        div.innerHTML = `
          <img src="${attraction.image}" alt="${attraction.name}">
          <div class="info">
              <h2>${attraction.name}</h2>
              <div class="date"><strong>日期：</strong><span class="normal">${date}</span></div>
              <div class="time"><strong>時間：</strong><span class="normal">${time === "morning" ? "上半天" : "下半天"}</span></div>
              <div class="price"><strong>費用：</strong><span class="normal">新台幣 ${price} 元</span></div>
              <div class="address"><strong>地點：</strong><span class="normal">${attraction.address}</span></div>
          </div>`;
        container.appendChild(div);
      }
    } catch (err) {
      console.error("fetchOrder 發生錯誤：", err);
      container.innerHTML = `<h3>載入訂單時發生錯誤，請稍後再試</h3>`;
    }
  }
  
  
  async function fetchFavorite() {
    const token = localStorage.getItem("token");
    if (!token) return;
  
    const container = document.querySelector(".member-container-content");
    if (!container) return;
  
    container.innerHTML = "<p>Loading...</p>";
  
    try {
      const res    = await fetch("/api/favorite", { headers: { Authorization: `Bearer ${token}` } });
      const result = await res.json();
  
      container.innerHTML = "";
  
      const favorites = result.data;
      if (!res.ok || !favorites || favorites.length === 0) {
        container.innerHTML = `<h3>目前沒有任何最愛的景點</h3>`;
        return;
      }
  
      for (const item of favorites) {
        const { id, name, category, address, mrt, description, images } = item;
        const imageUrl = images?.split(",")[0] || "/static/img/placeholder.jpg";
  
        const card = document.createElement("div");
        card.className = "booking_container_attraction";
        card.innerHTML = `
          <img src="${imageUrl}" alt="${name}">
          <div class="info">
              <h2>${name}</h2>
              <div class="mrt">${category} at ${mrt || "無捷運站"}</div>
              <div class="address"><strong>地點：</strong><span class="normal">${address}</span></div>
              <div class="description"><span class="normal">${description}</span></div>
              <a href="/attraction/${id}" class="attraction_id">查看景點</a>
          </div>`;
        container.appendChild(card);
      }
    } catch (err) {
      console.error("fetchFavorite 發生錯誤：", err);
      container.innerHTML = `<h3>載入我的最愛時發生錯誤，請稍後再試</h3>`;
    }
  }

  function setupHeartBtn() {
    const heartBtn = document.querySelector(".heart-btn");
    if (!heartBtn) return;

    heartBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("token");
        const attractionId = parseInt(heartBtn.dataset.id);

        if (!token) {
            showLoginDialog(); 
            return;
        }

        try {
            if (heartBtn.classList.contains("active")) {
                await fetch(`/api/favorite?attractionId=${attractionId}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` }
                });
                heartBtn.classList.remove("active");
            } else {
                await fetch(`/api/favorite?attractionId=${attractionId}`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` }
                });
                heartBtn.classList.add("active");
            }
        } catch (err) {
            console.error("收藏失敗：", err);
        }
    });
}

async function setupAttractionHeartBtn(attractionId) {
    attractionId = Number(attractionId);    
    const btn = document.querySelector(".all_btn_container .heart-btn");
    if (!btn) return;
  
    const token = localStorage.getItem("token");
    if (!token) return;
  
    try {
      const res    = await fetch("/api/favorite", { headers: { Authorization: `Bearer ${token}` } });
      const result = await res.json();
      const ids    = extractFavoriteIds(result.data);
  
      
      if (ids.includes(attractionId)) btn.classList.add("active");
  
      
      btn.addEventListener("click", async e => {
        e.preventDefault();
        try {
          const url  = `/api/favorite?attractionId=${attractionId}`;
          const opts = { headers: { Authorization: `Bearer ${token}` } };
          if (btn.classList.contains("active")) {
            await fetch(url, { ...opts, method: "DELETE" });
            btn.classList.remove("active");
          } else {
            await fetch(url, { ...opts, method: "POST"   });
            btn.classList.add("active");
          }
        } catch (err) {
          console.error("景點頁收藏失敗", err);
        }
      });
  
    } catch (err) {
      console.error("favorite讀取失敗", err);
    }
  }

  function extractFavoriteIds(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map(item => {
        if (typeof item === "number" || typeof item === "string") {
          return Number(item);
        }
        if (item && typeof item === "object") {
          
          return Number(
            item.id ??
            item.attraction_id ??
            item.attractionId
          );
        }
        return NaN;
      })
      .filter(n => Number.isFinite(n));
  }

  function setupFavorite() {
    const token = localStorage.getItem("token");
    if (!token) return;
  
    document.querySelectorAll(".card .heart-btn").forEach(btn => {
      btn.onclick = async e => {
        e.preventDefault();
        const id   = Number(btn.dataset.id);
        const url  = `/api/favorite?attractionId=${id}`;
        const opts = { headers: { Authorization: `Bearer ${token}` } };
  
        try {
          if (btn.classList.contains("active")) {
            await fetch(url, { ...opts, method: "DELETE" });
            btn.classList.remove("active");
          } else {
            await fetch(url, { ...opts, method: "POST"  });
            btn.classList.add("active");
          }
        } catch (err) {
          console.error("列表頁收藏失敗", err);
        }
      };
    });
  }