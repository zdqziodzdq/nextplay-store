/* NEXTPLAY — Traceurs chargés sur TOUTES les pages
   Un seul fichier à modifier si un identifiant change un jour. */

/* ===================== META PIXEL ===================== */
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');

fbq('init', '1807278287099246');
fbq('track', 'PageView');

/* ===================== GOOGLE ADS ===================== */
var GOOGLE_ADS_ID = 'AW-18336697346';

(function(){
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GOOGLE_ADS_ID;
  (document.head || document.getElementsByTagName('head')[0]).appendChild(s);
})();

window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', GOOGLE_ADS_ID);
