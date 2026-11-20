/* Physical faces, unlike split/adventure cards sharing one printed surface. */
(()=>{
'use strict';
function faces(card){
 const E=globalThis.MoxEDHREC,front=E.imageURLs({image_uris:card.image_uris})[0];
 if(front)return [front];
 return (card.card_faces||[]).map(face=>E.imageURLs({image_uris:face.image_uris})[0]||null);
}
function backPosition(x,y,width,height,shortEdge=false){return shortEdge?{x,y:height-y-88}:{x:width-x-63,y};}
globalThis.MoxfieldPlusPrintFaces={faces,backPosition};
})();
