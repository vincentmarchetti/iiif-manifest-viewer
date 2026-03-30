/*
Creates a Manifest3DViewer instance inside an existing HTMLElement identified
by id xite-view-container
    -- constructing this instance created both an HTML element with tag x3d-canvas
    -- along with the X_ITE browser object
    
Then configures a handler to a custom event new_manifest fired from document    
*/

import {Manifest3DViewer} from "./Manifest3DViewer.js";
import type {Manifest}    from "@kshell/manifesto-prezi4";

const XITE_VIEW_CONTAINER="xite-view-container";
const XITE_SHOWALL_BUTTON="xite-show-all";

export function initialize_x_ite_viewer(X3DLib:any){
    document.addEventListener("new_manifest", async (event) => {
        console.debug("new_manifest event received for X-ITE viewer");
        const container = document.getElementById(XITE_VIEW_CONTAINER);
        if (container === null)
            throw new Error(`X-ITE setup: getElementById(\"${XITE_VIEW_CONTAINER}\") failed`);
       
        // clear any existing canvas, this code not intended to support
        // multiple canvases on a page
        if (container.childElementCount > 0){
            console.log(`X-ITE viewer: clearing current canvas`);
            container.replaceChildren();
        }     
            
        const viewer = new Manifest3DViewer(X3DLib, container);    
        const showAllButton = document.getElementById(XITE_SHOWALL_BUTTON);
        if (showAllButton == null)
            console.warn(`X-ITE setup: getElementById(\"${XITE_SHOWALL_BUTTON}\") failed`);
        else
            viewer.showAllButton = showAllButton;
            
        const manifest:unknown = (event as any).detail.manifest;
        // sanity check
        if (manifest == null ) throw new Error(`event.detail.manifest is null`);
        if (typeof manifest != "object") throw new Error(`event.details.manifest is ${typeof manifest}`);
        await viewer.display( manifest as Manifest);
    });    
    console.debug("Added X-ITE listener to document \"new_manifest\" event");
}
