import { useEffect, useRef, useState } from 'react';
export function DefeatScare({onSkip,onShow,onHide}:{onSkip:()=>void;onShow:()=>void;onHide:()=>void}){
  const [cycle,setCycle]=useState(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{
    const visibility=()=>{
      if(timer.current){clearTimeout(timer.current);timer.current=null;}
      if(document.visibilityState==='hidden'){onHide();return;}
      setCycle(v=>v+1);onShow();timer.current=setTimeout(onSkip,4500);
    };
    visibility();document.addEventListener('visibilitychange',visibility);
    return()=>{document.removeEventListener('visibilitychange',visibility);if(timer.current)clearTimeout(timer.current);onHide();};
  },[onSkip,onShow,onHide]);
  return <div className="defeat-scare" role="dialog" aria-modal="true" aria-label="A ghostly woman screams after your defeat">
    <div className="scare-flash" key={`flash-${cycle}`} aria-hidden="true"/>
    <svg className="scare-figure" key={cycle} viewBox="0 0 500 600" role="img" aria-label="A pale ghost woman with wild hair, glowing eyes, and an open screaming mouth" shapeRendering="crispEdges">
      <path fill="#090913" d="M86 593 98 251 125 93 180 26 293 12 378 91 405 263 426 600Z"/>
      <path fill="#2d1831" d="M72 600 113 366 155 327 344 327 389 369 448 600Z"/>
      <path fill="#100b19" d="M36 600 91 429 128 339 167 379 119 600ZM464 600 405 414 373 338 341 385 384 600Z"/>
      <path fill="#d2d0c7" d="M158 133 214 73 299 81 348 147 338 303 296 368 206 368 157 296Z"/>
      <path fill="#9b9aa0" d="M157 166 175 255 190 295 196 179ZM344 161 325 255 309 294 308 172Z"/>
      <path fill="#10101a" d="M103 322 106 165 133 81 201 28 290 31 365 86 395 239 353 145 330 91 311 190 291 127 260 203 226 119 184 190 167 122 136 309Z"/>
      <path fill="#352038" d="M132 105 171 47 235 19 181 114 157 241ZM334 35 371 104 389 262 357 174 324 98Z"/>
      <path fill="#210e1e" d="M168 204 225 186 233 217 179 225ZM267 217 275 186 330 203 321 225Z"/>
      <path fill="#f5eeee" d="M178 207 224 199 222 220 181 222ZM278 199 323 207 319 222 280 220Z"/>
      <path fill="#d53048" d="M195 204 211 203 212 220 196 221ZM288 203 304 204 303 221 287 220Z"/>
      <path fill="#0b0711" d="M200 205 208 205 208 219 200 219ZM292 205 300 205 300 219 292 219Z"/>
      <path fill="#66616b" d="M245 221 236 274 250 281 265 274Z"/>
      <path fill="#6e1730" d="M212 299 236 288 268 288 291 299 278 343 250 359 222 343Z"/>
      <path fill="#150914" d="M224 309 249 301 276 309 269 345 250 350 231 344Z"/>
      <path fill="#ece6df" d="M222 308 234 307 230 324ZM237 303 248 301 245 320ZM252 301 264 304 258 321ZM269 305 280 310 270 324Z"/>
      <path fill="#c84961" d="M230 338 249 327 271 339 263 351 240 351Z"/>
      <path fill="none" stroke="#675565" strokeWidth="5" d="M180 235 204 247 229 236M272 235 299 248 322 235M190 264 179 295M314 265 324 294"/>
      <path fill="#d2d0c7" d="M103 391 65 458 53 531 75 538 93 476 106 540 126 535 127 464 144 515 162 506 156 430 136 372ZM389 385 428 457 446 529 424 537 407 477 392 539 374 534 373 464 353 513 336 505 346 428 366 373Z"/>
      <path fill="#090913" d="M55 527 75 532 70 554 49 558ZM105 531 124 530 128 551 108 555ZM144 500 160 500 168 520 151 525ZM427 531 446 525 452 555 432 557ZM375 529 393 532 392 554 372 552ZM338 498 354 500 351 525 333 518Z"/>
    </svg>
    <div className="scare-copy"><span>THE FINAL BELL</span><strong>SHE FOUND YOU</strong><small>THE GRAVEYARD NEVER FORGETS</small></div>
    <button className="scare-skip" onClick={onSkip} autoFocus>Skip scare</button>
  </div>;
}
