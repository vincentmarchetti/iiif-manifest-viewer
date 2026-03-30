import * as manifesto from "@kshell/manifesto-prezi4";
import {SceneRender, SceneHooks } from "./SceneRender.js";
import type X3D from "x_ite";


export interface IManifestRender{
    browser :  X3D.X3DBrowser,
    manifest : manifesto.Manifest,
    x3dLib   : X3D
}
export class Manifest3DViewer {

    public readonly browser : any ;
    public x3dLib: any ;
    
    public set showAllButton( button:HTMLElement){
        if (button === null){
            console.warn(`Manifest3DViewer.showAllButton (setter) : null argument`);
        }
        else{
        button.addEventListener("click" , ( event ) => {
            console.debug(`showAllButton click handler fired`);
            this.browser.viewAll();
            });
        }
    };

    
    
    constructor( x3dLib: X3D, container : HTMLElement ){
        this.x3dLib = x3dLib;
        const canvas = document.createElement("x3d-canvas");
        container.appendChild(canvas);
        if ((canvas as any).browser == null ){
            throw new Error("Manifest3DViewer.constructor: failed to create X_ITE browser");
        }
        this.browser = (canvas as any).browser;
        console.debug(`created browser: ${this.browser.name}:${this.browser.version}`);
    };
    
    
    
    /*
    intention is that this will be the entry point when a manifest is 
    loaded on startup or through user entry in an editable text box
    */
    public async display( manifest : manifesto.Manifest ):Promise<void> {
        /*
        manifest will be an instance of Manifest class from manifesto
        */
        console.log(`display manifest ${manifest.id}`);
        /*
        logic is that the first scene will be displayed
        */
        
        const scene  : manifesto.Scene   = (manifest as any).Items.filter( (res) => res.isScene )[0];       
        if (scene == null){
            console.warn("manifest with no Scene resources");
            return;
        };
        await this.renderScene( scene, manifest);  
    };
    
    public async displaySceneById( id : string, manifest: manifesto.Manifest ):Promise<void>
    {
        return; // still A NO-OP
    };
    /*
    Developer note 13 Jan 2026 . THe browser argument is 
    very loosely typed pending figuring out if the X_ITE
    package provides a more explicit type.
    */
    private async renderScene(  scene: manifesto.Scene, 
                                manifest: manifesto.Manifest){
        const props : IManifestRender = {
            "manifest" : manifest,
            "browser"  : this.browser,
            "x3dLib"   : this.x3dLib
        };

        const scene_handle = new SceneRender(scene, props);
        const hooks:SceneHooks =  await scene_handle.render();
    };
}


