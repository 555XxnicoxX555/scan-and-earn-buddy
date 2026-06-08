const fs = require("fs");
const path = require("path");

const root = __dirname;
const assets = path.join(root, "assets");
const out = path.join(root, "Sumi_Web_Proyecto_Visual.html");

function dataUri(file, mime) {
  const raw = fs.readFileSync(path.join(assets, file));
  return `data:${mime};base64,${raw.toString("base64")}`;
}

function svgUri(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const logo = dataUri("sumi-logo.jpg", "image/jpeg");
const hero = dataUri("sumi-cafe-qr-hero.jpg", "image/jpeg");
const cafeQrPhoto = dataUri("sumi-photo-cafe-qr.jpg", "image/jpeg");
const dashboardOwnerPhoto = dataUri("sumi-photo-dashboard-owner.jpg", "image/jpeg");
const rewardCustomerPhoto = dataUri("sumi-photo-reward-customer.jpg", "image/jpeg");
const qrScene = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 620">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7fbf8"/><stop offset="1" stop-color="#dff3ef"/></linearGradient><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#10201d" flood-opacity=".18"/></filter></defs>
<rect width="960" height="620" fill="url(#g)"/><circle cx="820" cy="90" r="120" fill="#17a7a2" opacity=".16"/><circle cx="110" cy="520" r="170" fill="#105fc4" opacity=".10"/>
<rect x="110" y="145" width="360" height="300" rx="22" fill="#fff" filter="url(#s)"/><rect x="144" y="178" width="126" height="126" rx="8" fill="#101918"/><path d="M162 196h32v32h-32zm58 0h32v32h-32zm-58 58h32v32h-32zm58 58h32v32h-32zm58-116h22v22h-22zm0 50h64v24h-64zm0 66h42v32h-42zm72-116h42v42h-42zm-206 150h260" stroke="#d8e4e0" stroke-width="10" stroke-linecap="round"/>
<rect x="545" y="96" width="230" height="430" rx="38" fill="#0b1514" filter="url(#s)"/><rect x="567" y="126" width="186" height="370" rx="28" fill="#fbfbf8"/><rect x="591" y="160" width="58" height="58" rx="12" fill="#105fc4"/><text x="666" y="199" font-family="Arial" font-size="32" font-weight="800" fill="#105fc4">Sumi</text><rect x="598" y="248" width="124" height="124" rx="10" fill="#101918"/><path d="M613 263h34v34h-34zm58 0h34v34h-34zm-58 58h34v34h-34zm58 58h34v34h-34" fill="#fff"/><rect x="591" y="397" width="138" height="70" rx="16" fill="#17a7a2"/><text x="612" y="426" font-family="Arial" font-size="16" font-weight="700" fill="#eafffb">Puntos</text><text x="612" y="454" font-family="Arial" font-size="30" font-weight="900" fill="#fff">1.840</text>
</svg>`);
const dashboardScene = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 620">
<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#071312"/><stop offset="1" stop-color="#105fc4"/></linearGradient><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="20" stdDeviation="22" flood-color="#071312" flood-opacity=".2"/></filter></defs>
<rect width="960" height="620" fill="#eef7f5"/><rect x="84" y="72" width="792" height="476" rx="28" fill="url(#a)" filter="url(#s)"/><circle cx="792" cy="120" r="140" fill="#17a7a2" opacity=".18"/><rect x="132" y="122" width="178" height="84" rx="16" fill="#fff" opacity=".12"/><rect x="342" y="122" width="178" height="84" rx="16" fill="#fff" opacity=".12"/><rect x="552" y="122" width="178" height="84" rx="16" fill="#fff" opacity=".12"/><text x="158" y="174" font-family="Arial" font-size="38" font-weight="900" fill="#fff">1.284</text><text x="368" y="174" font-family="Arial" font-size="38" font-weight="900" fill="#fff">37%</text><text x="578" y="174" font-family="Arial" font-size="38" font-weight="900" fill="#fff">$8.9k</text><rect x="132" y="258" width="370" height="230" rx="18" fill="#fff" opacity=".10"/><path d="M165 440c58-98 103-118 152-72s88 38 154-72" fill="none" stroke="#8fded7" stroke-width="16" stroke-linecap="round"/><path d="M165 445h300M165 385h300M165 325h300" stroke="#fff" stroke-opacity=".12" stroke-width="6"/><rect x="550" y="258" width="266" height="36" rx="18" fill="#fff" opacity=".18"/><rect x="550" y="326" width="220" height="36" rx="18" fill="#17a7a2"/><rect x="550" y="394" width="166" height="36" rx="18" fill="#d89522"/><text x="132" y="92" font-family="Arial" font-size="28" font-weight="800" fill="#101918">Panel visual de gestion</text>
</svg>`);
const loyaltyScene = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 620">
<rect width="960" height="620" fill="#fbfbf8"/><path d="M0 520c180-70 280-20 430-72s280-150 530-66v238H0z" fill="#dff3ef"/><circle cx="168" cy="180" r="74" fill="#105fc4"/><circle cx="480" cy="180" r="74" fill="#17a7a2"/><circle cx="792" cy="180" r="74" fill="#d89522"/><path d="M242 180h164M554 180h164" stroke="#d8e4e0" stroke-width="14" stroke-linecap="round"/><text x="168" y="193" text-anchor="middle" font-family="Arial" font-size="44" font-weight="900" fill="#fff">1</text><text x="480" y="193" text-anchor="middle" font-family="Arial" font-size="44" font-weight="900" fill="#fff">2</text><text x="792" y="193" text-anchor="middle" font-family="Arial" font-size="44" font-weight="900" fill="#fff">3</text><rect x="86" y="295" width="180" height="140" rx="18" fill="#fff" stroke="#d8e4e0"/><rect x="390" y="295" width="180" height="140" rx="18" fill="#fff" stroke="#d8e4e0"/><rect x="694" y="295" width="180" height="140" rx="18" fill="#fff" stroke="#d8e4e0"/><text x="176" y="353" text-anchor="middle" font-family="Arial" font-size="24" font-weight="900" fill="#101918">Compra</text><text x="480" y="353" text-anchor="middle" font-family="Arial" font-size="24" font-weight="900" fill="#101918">Suma</text><text x="784" y="353" text-anchor="middle" font-family="Arial" font-size="24" font-weight="900" fill="#101918">Vuelve</text><text x="176" y="390" text-anchor="middle" font-family="Arial" font-size="18" fill="#5b6765">ticket</text><text x="480" y="390" text-anchor="middle" font-family="Arial" font-size="18" fill="#5b6765">puntos</text><text x="784" y="390" text-anchor="middle" font-family="Arial" font-size="18" fill="#5b6765">canje</text>
</svg>`);

const html = String.raw`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sumi | Fidelizacion gastronomica</title>
  <style>
    :root{
      --ink:#101918; --muted:#5b6765; --blue:#105fc4; --blue-2:#0c4fb1; --teal:#0f766e;
      --aqua:#17a7a2; --gold:#d89522; --paper:#fbfbf8; --soft:#eef7f5; --line:#d8e4e0;
      --white:#fff; --dark:#071312; --shadow:0 22px 60px rgba(11,23,21,.16);
    }
    *{box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{margin:0;font-family:Arial,Helvetica,sans-serif;color:var(--ink);background:var(--paper);line-height:1.5}
    a{color:inherit;text-decoration:none}
    .wrap{max-width:1180px;margin:0 auto;padding:0 24px}
    header{position:sticky;top:0;z-index:30;background:rgba(255,255,255,.9);backdrop-filter:blur(14px);border-bottom:1px solid rgba(16,25,24,.08)}
    nav{height:72px;display:flex;align-items:center;justify-content:space-between;gap:20px}
    .brand{display:flex;align-items:center;gap:10px;font-weight:900;color:var(--blue);letter-spacing:0}
    .brand img{width:42px;height:42px;border-radius:8px;object-fit:cover;box-shadow:0 8px 22px rgba(16,95,196,.16)}
    .brand span{font-size:25px}
    .links{display:flex;gap:18px;align-items:center;font-size:14px;color:var(--muted)}
    .links a{padding:8px 0}.links a:hover{color:var(--blue)}
    .btn{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:8px;background:var(--blue);color:white;font-weight:800;padding:12px 16px;box-shadow:0 14px 32px rgba(16,95,196,.22)}
    .btn.ghost{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.34);box-shadow:none}
    .hero{position:relative;min-height:calc(100vh - 72px);display:grid;align-items:end;overflow:hidden;background:var(--dark)}
    .hero:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,13,12,.96) 0%,rgba(5,13,12,.82) 34%,rgba(5,13,12,.38) 69%,rgba(5,13,12,.16)),url("${hero}") center/cover no-repeat;transform:scale(1.02)}
    .hero:after{content:"";position:absolute;inset:auto 0 0;height:36%;background:linear-gradient(0deg,var(--paper),rgba(251,251,248,0))}
    .hero .wrap{position:relative;z-index:1;width:100%;padding-top:88px;padding-bottom:86px}
    .hero-grid{display:grid;grid-template-columns:minmax(0,1fr) 410px;gap:46px;align-items:end}
    .hero-logo{display:inline-flex;align-items:center;gap:14px;margin-bottom:22px;padding:10px 14px;border-radius:8px;background:rgba(255,255,255,.92);box-shadow:0 18px 46px rgba(0,0,0,.18)}
    .hero-logo img{width:66px;height:66px;border-radius:8px;object-fit:cover}.hero-logo b{font-size:30px;color:var(--blue)}.hero-logo small{display:block;color:var(--muted);font-weight:700;letter-spacing:1.8px;text-transform:uppercase}
    .tag{display:inline-flex;background:rgba(23,167,162,.18);border:1px solid rgba(23,167,162,.36);color:#d9fffb;border-radius:999px;padding:8px 12px;font-size:13px;font-weight:800}
    h1{margin:18px 0 14px;font-size:clamp(42px,6vw,80px);line-height:.95;max-width:850px;color:white;letter-spacing:0}
    .hero p{max-width:680px;color:rgba(255,255,255,.86);font-size:19px;margin:0 0 26px}.hero-actions{display:flex;gap:12px;flex-wrap:wrap}
    .phone{justify-self:end;width:100%;max-width:390px;border-radius:34px;padding:16px;background:#0b1514;border:1px solid rgba(255,255,255,.16);box-shadow:0 30px 80px rgba(0,0,0,.42);transform:rotate(2deg)}
    .screen{border-radius:24px;background:linear-gradient(180deg,#fff,#f3faf8);padding:18px;min-height:520px;overflow:hidden}
    .app-top{display:flex;align-items:center;gap:10px}.app-top img{width:42px;height:42px;border-radius:8px}.app-top b{font-size:24px;color:var(--blue)}
    .qr-box{margin:22px auto 18px;width:190px;aspect-ratio:1;border-radius:8px;background:repeating-linear-gradient(90deg,#111 0 10px,#fff 10px 20px);position:relative;box-shadow:inset 0 0 0 12px white}
    .qr-box:before,.qr-box:after{content:"";position:absolute;width:44px;height:44px;border:10px solid #111;background:white}.qr-box:before{left:16px;top:16px}.qr-box:after{right:16px;bottom:16px}
    .points{background:linear-gradient(135deg,var(--blue),var(--aqua));border-radius:8px;color:white;padding:18px;margin-top:12px}.points strong{display:block;font-size:38px;line-height:1}
    .reward-list{display:grid;gap:10px;margin-top:16px}.reward{display:flex;justify-content:space-between;align-items:center;padding:12px;border:1px solid var(--line);border-radius:8px;background:white;font-size:14px}
    section{padding:86px 0;position:relative}.section-head{display:grid;grid-template-columns:1fr minmax(260px,440px);gap:40px;align-items:end;margin-bottom:28px}
    .eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:2px;color:var(--blue);font-weight:900;margin-bottom:8px}
    h2{margin:0;font-size:clamp(30px,4vw,52px);line-height:1.02;letter-spacing:0}h3{margin:0 0 10px;font-size:20px}p{color:var(--muted)}.lead{font-size:17px;margin:0}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.cards4{grid-template-columns:repeat(4,1fr)}
    .card{background:white;border:1px solid rgba(16,25,24,.08);border-radius:8px;padding:24px;box-shadow:0 12px 34px rgba(19,32,31,.07)}
    .visual-card{overflow:hidden;padding:0}.visual-card img{width:100%;height:230px;object-fit:cover;display:block;background:#eef7f5}.visual-card.tall img{height:330px}.visual-card .inside{padding:22px}
    .band{background:linear-gradient(180deg,#eef7f5,#f9fbf8)}
    .brand-band{padding:46px 0;background:var(--blue);color:white;overflow:hidden}.brand-band .wrap{display:flex;align-items:center;justify-content:space-between;gap:28px}.brand-band img{width:140px;border-radius:8px;background:white}.brand-band p{margin:0;color:rgba(255,255,255,.86);max-width:720px;font-size:20px}
    .price{font-size:30px;font-weight:900;color:var(--blue);line-height:1;margin-bottom:12px}.metric b{font-size:44px;color:var(--blue);display:block;line-height:1}.metric span{color:var(--muted);font-size:14px}
    .mock-section{display:grid;grid-template-columns:1.1fr .9fr;gap:28px;align-items:center}
    .dashboard{background:#0d1716;color:white;border-radius:8px;padding:24px;box-shadow:var(--shadow);min-height:360px;position:relative;overflow:hidden}
    .dashboard:before{content:"";position:absolute;inset:-60px -80px auto auto;width:240px;height:240px;border-radius:50%;background:rgba(23,167,162,.22)}
    .dash-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}.dash-logo{display:flex;gap:10px;align-items:center}.dash-logo img{width:44px;height:44px;border-radius:8px}.pill{border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:6px 10px;color:#bff4ee;font-size:12px}
    .dash-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.dash-box{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:16px}.dash-box b{font-size:30px;display:block}.dash-box span{color:rgba(255,255,255,.68);font-size:13px}
    .bars{margin-top:18px;display:grid;gap:10px}.bar{height:12px;background:rgba(255,255,255,.12);border-radius:999px;overflow:hidden}.bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--aqua),#8fded7)}
    .journey{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.step{position:relative;background:white;border-radius:8px;border:1px solid var(--line);padding:24px;min-height:190px}.step-num{width:42px;height:42px;border-radius:50%;background:var(--blue);color:white;display:grid;place-items:center;font-weight:900;margin-bottom:16px}
    .benefits{display:grid;grid-template-columns:1fr 1fr;gap:18px}.benefit{min-height:260px;border-radius:8px;padding:26px;color:white;background:linear-gradient(135deg,#071312,#105fc4);position:relative;overflow:hidden}.benefit:after{content:"";position:absolute;right:-56px;bottom:-56px;width:190px;height:190px;border-radius:50%;background:rgba(255,255,255,.12)}.benefit.alt{background:linear-gradient(135deg,#0f766e,#d89522)}
    .scenario strong{font-size:20px}.scenario b{display:block;margin-top:12px;color:var(--blue)}.scenario .bar{margin:12px 0;background:#e4ece8}.scenario .bar i{background:linear-gradient(90deg,var(--blue),var(--aqua))}
    .sources a{color:var(--blue);font-weight:800}.cta{background:#071312;color:white;text-align:center}.cta h2{color:white}.cta p{color:rgba(255,255,255,.74);max-width:780px;margin:14px auto 22px}footer{padding:26px 0;color:var(--muted);font-size:13px}
    .fade{opacity:0;transform:translateY(18px);transition:opacity .7s ease,transform .7s ease}.fade.show{opacity:1;transform:none}
    @media (max-width:900px){
      .links{display:none}.hero-grid,.section-head,.mock-section{grid-template-columns:1fr}.phone{justify-self:start;max-width:340px}.grid,.cards4,.journey,.benefits{grid-template-columns:1fr}.brand-band .wrap{align-items:flex-start;flex-direction:column}section{padding:64px 0}h1{font-size:44px}.hero p{font-size:17px}
    }
  </style>
</head>
<body>
<header><div class="wrap"><nav><a class="brand" href="#top"><img src="${logo}" alt="Logo Sumi"><span>Sumi</span></a><div class="links"><a href="#problema">Problema</a><a href="#solucion">Solucion</a><a href="#precios">Cobros</a><a href="#finanzas">Finanzas</a><a href="#fuentes">Fuentes</a></div><a class="btn" href="#finanzas">Ver numeros</a></nav></div></header>
<main id="top">
  <section class="hero">
    <div class="wrap">
      <div class="hero-grid">
        <div>
          <div class="hero-logo fade"><img src="${logo}" alt="Logo Sumi"><div><b>Sumi</b><small>Puntos beneficios clientes felices</small></div></div>
          <span class="tag fade">Sistema de fidelizacion para gastronomia</span>
          <h1 class="fade">Clientes que vuelven, datos que sirven.</h1>
          <p class="fade">Sumi combina menu QR, registro de clientes, puntos, canjes y panel de gestion para que cafeterias, bares y restaurantes conviertan compras aisladas en recompra medible.</p>
          <div class="hero-actions fade"><a class="btn" href="#precios">Modelo comercial</a><a class="btn ghost" href="#solucion">Como funciona</a></div>
        </div>
        <div class="phone fade" aria-label="Mockup de app Sumi">
          <div class="screen">
            <div class="app-top"><img src="${logo}" alt=""><b>Sumi</b></div>
            <div class="qr-box"></div>
            <div class="points"><span>Saldo disponible</span><strong>1.840</strong><span>puntos para canjear</span></div>
            <div class="reward-list">
              <div class="reward"><b>Cafe chico</b><span>650 pts</span></div>
              <div class="reward"><b>Combo merienda</b><span>1.500 pts</span></div>
              <div class="reward"><b>Beneficio cumple</b><span>activo</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
  <section class="brand-band"><div class="wrap"><img src="${logo}" alt="Logo Sumi"><p>Una marca simple para poner en la mesa, en el mostrador y en el celular del cliente: puntos, beneficios y clientes felices.</p></div></section>
  <section id="problema"><div class="wrap"><div class="section-head fade"><div><div class="eyebrow">Problema</div><h2>Muchos locales venden, pero no construyen recurrencia.</h2></div><p class="lead">La gastronomia suele depender del transito, promociones generales y memoria del cliente. Sin datos, el local no sabe quien vuelve, cuanto compra ni que incentivo realmente funciona.</p></div><div class="grid cards3"><article class="card visual-card fade"><img src="${cafeQrPhoto}" alt="Mesa de cafe con QR de fidelizacion"><div class="inside"><h3>Promociones sin control</h3><p>Descuentos amplios pueden aumentar ventas, pero tambien destruir margen si no estan ligados a frecuencia o comportamiento.</p></div></article><article class="card visual-card fade"><img src="${dashboardOwnerPhoto}" alt="Duenio revisando panel Sumi"><div class="inside"><h3>Poca informacion</h3><p>El local conoce la venta del dia, pero no necesariamente la historia del cliente, su frecuencia o sus canjes.</p></div></article><article class="card visual-card fade"><img src="${rewardCustomerPhoto}" alt="Cliente canjeando recompensa"><div class="inside"><h3>Recompra debil</h3><p>Si el cliente no tiene motivo claro para volver, la relacion termina despues de una compra.</p></div></article></div></div></section>
  <section id="solucion" class="band"><div class="wrap"><div class="section-head fade"><div><div class="eyebrow">Solucion</div><h2>Sumi digitaliza la fidelizacion del local.</h2></div><p class="lead">Cada cliente puede registrarse, sumar puntos por compras y canjear beneficios. El local administra puntos, promociones y datos desde un panel simple.</p></div><article class="card visual-card fade" style="margin-bottom:24px"><img src="${loyaltyScene}" alt="Flujo visual de fidelizacion" style="height:auto;max-height:360px;object-fit:contain"></article><div class="journey"><article class="step fade"><div class="step-num">1</div><h3>QR del local</h3><p>El cliente escanea el menu o punto de entrada de Sumi desde la mesa o mostrador.</p></article><article class="step fade"><div class="step-num">2</div><h3>Registro</h3><p>Crea su perfil y obtiene un QR personal para sumar puntos en futuras compras.</p></article><article class="step fade"><div class="step-num">3</div><h3>Compra</h3><p>El local carga el consumo desde el panel y acredita puntos automaticamente.</p></article><article class="step fade"><div class="step-num">4</div><h3>Canje</h3><p>El cliente vuelve para usar beneficios controlados por el negocio.</p></article></div></div></section>
  <section><div class="wrap"><div class="section-head fade"><div><div class="eyebrow">Experiencia</div><h2>La pagina ahora muestra el producto en contexto.</h2></div><p class="lead">Sumi no queda como una idea abstracta: se ve en la mesa, en el panel del local y en el momento del canje.</p></div><div class="grid"><article class="card visual-card tall fade"><img src="${cafeQrPhoto}" alt="QR Sumi en mesa de cafeteria"><div class="inside"><h3>En la mesa</h3><p>El QR funciona como puerta de entrada al menu, puntos y beneficios.</p></div></article><article class="card visual-card tall fade"><img src="${dashboardOwnerPhoto}" alt="Panel de gestion Sumi"><div class="inside"><h3>En la gestion</h3><p>El local entiende actividad, canjes y recompra desde una pantalla clara.</p></div></article><article class="card visual-card tall fade"><img src="${rewardCustomerPhoto}" alt="Canje de recompensa Sumi"><div class="inside"><h3>En la recompra</h3><p>El cliente vuelve porque tiene un beneficio concreto para usar.</p></div></article></div></div></section>
  <section><div class="wrap mock-section"><div class="dashboard fade"><div class="dash-top"><div class="dash-logo"><img src="${logo}" alt=""><b>Panel Sumi</b></div><span class="pill">local activo</span></div><div class="dash-grid"><div class="dash-box"><b>1.284</b><span>clientes registrados</span></div><div class="dash-box"><b>37%</b><span>recompra estimada</span></div><div class="dash-box"><b>$8.900</b><span>ticket promedio</span></div><div class="dash-box"><b>246</b><span>canjes del mes</span></div></div><div class="bars"><div class="bar"><i style="width:86%"></i></div><div class="bar"><i style="width:64%"></i></div><div class="bar"><i style="width:42%"></i></div></div></div><div class="card visual-card fade"><img src="${dashboardOwnerPhoto}" alt="Duenio usando dashboard Sumi" style="height:360px"><div class="inside"><div class="eyebrow">Gestion visual</div><h2>El local ve datos, no solo ventas.</h2><p class="lead">El panel resume actividad, frecuencia, puntos emitidos, beneficios canjeados y campanias. Esa informacion permite ajustar promociones sin regalar margen a ciegas.</p></div></div></div></section>
  <section id="precios" class="band"><div class="wrap"><div class="section-head fade"><div><div class="eyebrow">Cobros al cliente</div><h2>Un modelo simple de vender y explicar.</h2></div><p class="lead">La propuesta se cobra a locales gastronomicos con una implementacion inicial, un abono mensual y extras opcionales para ampliar el uso.</p></div><div class="grid cards4"><article class="card metric fade"><div class="price">$1.200.000</div><span>Implementacion inicial: configuracion, menu digital, panel, sistema de puntos y 10 QR fisicos.</span></article><article class="card metric fade"><div class="price">$150.000</div><span>Abono mensual por local activo: hosting, soporte base, mantenimiento y estadisticas.</span></article><article class="card metric fade"><div class="price">$45.000</div><span>QR adicional para mesa, mostrador o nueva zona del local.</span></article><article class="card metric fade"><div class="price">$60.000</div><span>Campania especial: cumpleanos, referidos, promo puntual u horario de baja demanda.</span></article></div></div></section>
  <section id="finanzas"><div class="wrap"><div class="section-head fade"><div><div class="eyebrow">Modelo financiero</div><h2>La rentabilidad depende de cartera activa.</h2></div><p class="lead">Con los precios actualizados en ARS, el punto de equilibrio recurrente queda en 14 locales activos sin contar nuevas implementaciones.</p></div><div class="grid cards4"><article class="card metric fade"><b>14</b><span>locales activos para cubrir costos fijos recurrentes</span></article><article class="card metric fade"><b>$150k</b><span>abono mensual por local</span></article><article class="card metric fade"><b>$691k</b><span>margen estimado por implementacion</span></article><article class="card metric fade"><b>$146k</b><span>margen mensual estimado por local</span></article></div><div style="height:28px"></div><div class="grid"><div class="card scenario fade"><strong>Conservador</strong><div><div class="bar"><i style="width:42%"></i></div><span>21 locales al mes 12</span></div><b>$5,2M acumulado aprox.</b></div><div class="card scenario fade"><strong>Base</strong><div><div class="bar"><i style="width:72%"></i></div><span>42 locales al mes 12</span></div><b>$40,4M acumulado aprox.</b></div><div class="card scenario fade"><strong>Optimista</strong><div><div class="bar"><i style="width:100%"></i></div><span>66 locales al mes 12</span></div><b>$80,5M acumulado aprox.</b></div></div></div></section>
  <section id="fidelizacion" class="band"><div class="wrap"><div class="section-head fade"><div><div class="eyebrow">Fidelizacion</div><h2>Los puntos no son regalos: son una herramienta de gestion.</h2></div><p class="lead">El objetivo es que el costo del beneficio sea menor que el margen incremental generado por visitas repetidas, recomendaciones y compras en horarios de baja demanda.</p></div><div class="benefits"><article class="benefit fade"><h3>Beneficios que empujan visitas</h3><p style="color:rgba(255,255,255,.78)">Cafe chico, combo merienda, referidos y cumpleanos pueden configurarse para horarios o productos especificos.</p></article><article class="benefit alt fade"><h3>Datos para decidir</h3><p style="color:rgba(255,255,255,.82)">Clientes activos, frecuencia, ticket, puntos emitidos, canjes y campanias efectivas.</p></article></div></div></section>
  <section id="fuentes"><div class="wrap"><div class="section-head fade"><div><div class="eyebrow">Fuentes</div><h2>Precios de referencia usados.</h2></div><p class="lead">Los importes del modelo fueron ajustados con referencias reales/locales para que la defensa del trabajo sea mas solida.</p></div><div class="grid cards3 sources"><article class="card fade"><h3>Dominio</h3><p>NIC Argentina para aranceles .com.ar.</p><a href="https://nic.ar/index.php/es/dominios/aranceles">nic.ar</a></article><article class="card fade"><h3>QR acrilico</h3><p>PIAD Grafico como referencia de cartel QR acrilico.</p><a href="https://www.piadgrafico.com.ar/emprendimientos/cartel-qr-acrilico">piadgrafico.com.ar</a></article><article class="card fade"><h3>Hosting</h3><p>DonWeb como hosting local de referencia.</p><a href="https://donweb.com/es-ar/web-hosting">donweb.com</a></article><article class="card fade"><h3>Desarrollo web</h3><p>Rangos 2026 para landing y desarrollo web en Argentina.</p><a href="https://manivela.com.ar/blog/cuanto-cuesta-landing-page-argentina-2026">manivela.com.ar</a></article><article class="card fade"><h3>Dolar referencia</h3><p>Banco Nacion historico usado para equivalencias.</p><a href="https://dolarhistorico.com/dolar-banco-nacion/mes/junio-2026">dolarhistorico.com</a></article><article class="card fade"><h3>Archivo financiero</h3><p>El detalle completo esta en el Excel actualizado del proyecto.</p></article></div></div></section>
  <section class="cta"><div class="wrap fade"><img src="${logo}" alt="Logo Sumi" style="width:92px;border-radius:8px;background:white;margin-bottom:18px"><h2>Sumi convierte consumo en recompra medible.</h2><p>La idea es defendible como negocio ficticio porque combina gestion gastronomica, costos reales, ingresos recurrentes y una propuesta de valor clara para el local.</p><a class="btn" href="#top">Volver arriba</a></div></section>
</main>
<footer><div class="wrap">Sumi - Proyecto gastronomico ficticio | Modelo actualizado el 7 de junio de 2026</div></footer>
<script>
  const observer = new IntersectionObserver((entries)=>entries.forEach((entry)=>{if(entry.isIntersecting) entry.target.classList.add("show")}),{threshold:.12});
  document.querySelectorAll(".fade").forEach((el)=>observer.observe(el));
</script>
</body>
</html>`;

fs.writeFileSync(out, html, "utf8");
console.log(out);
