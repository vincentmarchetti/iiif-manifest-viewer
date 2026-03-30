/*
Developer Note: 13 Jan 2026
This function is intended solely for development purposes
It retrieves a glb model and adds it to a scene
in the browser. 

It may also be a prototype for showing a "splash model"
in the 3D View, or copy in the X_ITE 3D Logo
*/

export async function render_stub_content(browser:any):void {
    /* 
    this function is a stub to just show something
    -- as specified by a url to a glb model
    in the viewer; eventually this needs to be replaced
    by the call that will cause a manifest to be rendered
    by the viewer
    */

    const model_url = "https://spri-open-resources.s3.us-east-2.amazonaws.com/iiif3dtsg/woodblocks/redF.glb";
    // reference: https://create3000.github.io/x_ite/accessing-the-external-browser/#pure-javascript
    const scene =  await browser.createScene();
    const inline = scene.createNode("Inline");
    inline.url = new X3D.MFString([ model_url ]);
    scene.rootNodes.push(inline);
    
    console.debug("loading scene");
    await browser.replaceWorld(scene);  
    console.log("render_stub_content: scene replaced");
};
