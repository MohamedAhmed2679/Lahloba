export interface MapMarker { lat: number; lng: number; label: string; kind?: 'start' | 'end' | 'courier' }
export interface MapRoute { from: { lat: number; lng: number }; to: { lat: number; lng: number }; done?: boolean }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Self-contained Leaflet page showing OpenStreetMap tiles (with the required attribution).
 * Only public, approximate area points are ever drawn; exact addresses never reach the map.
 */
export function osmHtml(markers: MapMarker[], routes: MapRoute[], colors: { route: string; done: string; start: string; end: string }) {
  const data = JSON.stringify({ markers: markers.map((m) => ({ ...m, label: esc(m.label) })), routes });
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="">
<style>html,body,#m{height:100%;margin:0;background:#EDE3D1}.leaflet-control-attribution{font-size:10px}</style></head>
<body><div id="m" role="img"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
var d=${data};var map=L.map('m',{zoomControl:false,attributionControl:true});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
var pts=[];
d.routes.forEach(function(r){L.polyline([[r.from.lat,r.from.lng],[r.to.lat,r.to.lng]],{color:r.done?'${colors.done}':'${colors.route}',weight:5,dashArray:r.done?null:'8 8'}).addTo(map);});
d.markers.forEach(function(m){var c=m.kind==='end'?'${colors.end}':'${colors.start}';
L.circleMarker([m.lat,m.lng],{radius:9,color:'#fff',weight:3,fillColor:c,fillOpacity:1}).addTo(map).bindTooltip(m.label,{permanent:true,direction:'top',offset:[0,-8]});pts.push([m.lat,m.lng]);});
if(pts.length>1){map.fitBounds(pts,{padding:[40,40]});}else if(pts.length===1){map.setView(pts[0],13);}else{map.setView([30.0444,31.2357],11);}
</script></body></html>`;
}
