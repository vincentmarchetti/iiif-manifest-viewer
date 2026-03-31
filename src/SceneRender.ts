import * as manifesto from "@kshell/manifesto-prezi4";
import {IManifestRender} from "./Manifest3DViewer.js";
import {Transform, 
        transformsToPlacements, 
        Rotation, 
        Translation, 
        Placement, 
        relativeRotation } from "@kshell/iiif-x3d-transforms";

import type X3D from "x_ite";

type WrappedInline = X3D.ConcreteNodeTypes["Transform"] | X3D.ConcreteNodeTypes["Inline"];
type ColorType = [number,number,number];

// Developer Note: Jan 13 2026, import of render_stub_content is strictly a 
// development feature, not relevant to production level
//import {render_stub_content} from "./render_stub_content.ts";
//import {expect} from "chai";


/*
Code in this module assumes there is an object this.manifest_render.x3dLib in the global context due
to having imported the X_ITE library. This will be sanity-checked in the
constructor for the SceneRender class
*/

/*
SceneHooks will be an instance with a number of elements
referring to HTMLElements inside the scene, or other constructs,
that can be used to client to connect to external UI elements
for the purpose of modifying the scene.

It will support the mechanism by which activating annotations are triggered
by HTML events.
*/
export interface SceneHooks {
    NavigationInfo : any
};

type AxesValues = manifesto.AxesValues; // rem: an array of 4 numbers


function TransformsForBody( resource : manifesto.JSONLDResource):Transform[] {
    if ((resource as any).isSpecificResource ){
        /*
        Developer note Mar 23 2026
        Here is an unfortunate naming quirk. As inherites from the IIIF Presentation 4
        spec, the property on the manifesto.SpecificResource call Transform is 
        a list of IIIF Transform resources
        */
        const transformList :   manifesto.ITransform[] = (resource as unknown as manifesto.SpecificResource).Transform ?? 
                                ([] as manifesto.ITransform[]);
        try{
            return transformList.map( (t:manifesto.ITransform, index:number):Transform =>{
                try{
                    return Transform.from_manifesto_transform(t);
                }
                catch (error){
                    const msg=`Array.map index ${index} | ${error}`;
                    throw new Error(msg);
                }
            });
        }
        catch (error){
            const msg = `SceneRender.TransformsForBody | ${error}`;
            throw new Error(msg);
            // dev note 20260301: following is essentially "ignore bad input"
            // remove as cruft 1 April 2026
            console.error(msg); 
            return ( [] as Transform[] )
        }
    };
    return ( [] as Transform[] );
};

function TranslationForTarget( resource : manifesto.JSONLDResource):Translation {
    try{

    const selector = (( resource as any).isSpecificResource && 
                        (resource as manifesto.SpecificResource).Selector) ?? null;    
    return  (selector?.isPointSelector && Transform.from_point_selector(selector)) ?? Translation.Identity;
    }
    catch (error){
        const msg = `TranslationForTarget | ${error}`;
        throw new Error(msg);
    }
};

function thisOrSource(resource: manifesto.JSONLDResource):manifesto.ManifestResource{
    if ((resource as any).isSpecificResource ) 
        return (resource as manifesto.SpecificResource).Source as manifesto.ManifestResource;
    return  resource as unknown as manifesto.ManifestResource;
}

/*
Developer Note: Mar 23 2026
Am calling this class SceneRender just to cut down on the large and disparate
uses of the term Scene
*/
export class SceneRender {

    private manifest_render : IManifestRender;
    private scene_properties : manifesto.Scene;
    
    // a default color for background in X3D color convention, 0 is black, 1.0 is white 
    private readonly defaultBackground : [number, number, number]= [0.925,0.925,0.925];    
    
    private hooks: SceneHooks = {
        NavigationInfo: null
    };
    
    public constructor( scene : manifesto.Scene, manifest_render:IManifestRender){        
        this.manifest_render = manifest_render;
        this.scene_properties = scene;
        
        if ( this.manifest_render.x3dLib == undefined ){
            throw new Error("global this.manifest_render.x3dLib not defined in SceneRender.constuctor");
        }
    };
    
    private scene_x3d: any;
    
    private createNode( tag:string ) {
        if (this.scene_x3d == null){
            throw new Error("SceneRender.createNode: scene_node not initialized");
        }
        console.debug(`SceneRender.createNode ${tag}`);
        return this.scene_x3d.createNode(tag);
    }
    
    /*
    Developer note: 13 Jan 2026 Functionally this should be put in the
    constructor, but I have a superstition agains putting a instance constructor
    inside an await loop. 
    Clients should call this function asynchrously after constucting the
    SceneRender instance synchronously
    */
    public async render() : Promise<SceneHooks> {
        console.debug( `enter SceneRende.render for scene ${this.scene_properties?.id}`);
        
        /*
        scene_x is a constructed representation of the scenegraph int he X_ITE 
        context. It is roughly  the Scene element in the this.manifest_render.x3dLib as well as the DOM tree. 
        Strictly, it  it is not an this.manifest_render.x3dLib node.
        
        Calling it scene_x to avoid confusion with this.scene, the static IIIF resource
        as represented in manifesto
        */
        const profile:X3D.ProfileInfo = this.manifest_render.browser.getProfile("Full");
        this.scene_x3d =  await this.manifest_render.browser.createScene(profile);
        
        this.addNavigationInfo(  this.scene_x3d.rootNodes );
        this.addDefaultLighting( this.scene_x3d.rootNodes );
        this.addBackground(      this.scene_x3d.rootNodes );
        
        this.scene_properties.Items.forEach( (page:manifesto.AnnotationPage) => {
            this.addAnnotationPage(this.scene_x3d.rootNodes, page);
        });
        
        await this.manifest_render.browser.replaceWorld(this.scene_x3d); 
        //await render_stub_content(this.browser);
        
        
        return this.hooks;
    }
    
    private addNavigationInfo(container):void {
        const navInfo = this.createNode("NavigationInfo");
        navInfo.headlight = new this.manifest_render.x3dLib.SFBool(true);
        this.hooks.NavigationInfo = navInfo;
        container.push(navInfo);
    }
    
    private addBackground(container):void {
        // rgb is the array of rgb values in [0.0..1.0] interval
        const rgb= (():ColorType => {
            const c : manifesto.Color | null = this.scene_properties.BackgroundColor;
            if (c == null) return this.defaultBackground;
            
            return ([c.red, c.green, c.blue]
                    .map( (v):number => Math.min(Math.round(v/0.255)*0.001, 1.0))) as ColorType;
        })();
                                
        const backGround = this.createNode("Background");
        backGround.skyColor = new this.manifest_render.x3dLib.MFColor(
            new this.manifest_render.x3dLib.SFColor(...rgb)
        );
        container.push(backGround);
    }
    
    private addAnnotationPage(container, page: manifesto.AnnotationPage):void {
        const group  = this.createNode("Group");
        page.Items.forEach( (anno:manifesto.Annotation):void => {
            this.addAnnotation( group.children , anno );
        });
        container.push(group);
    }
    
    private addDefaultLighting(container):void {
        const directionData : AxesValues[] 
            =   [ [0.0 , -0.81649658, -0.57735027] ,
                [-0.5, -0.81649658,  0.28867513],
                [+0.5, -0.81649658,  0.28867513]];
        directionData.forEach( (vec:AxesValues) => {
            const light = this.createNode("DirectionalLight");
            light.direction = new this.manifest_render.x3dLib.SFVec3f(...vec);
            light.global =    new this.manifest_render.x3dLib.SFBool(true);
            light.intensity = new this.manifest_render.x3dLib.SFFloat(1.0);
            light.ambientIntensity = new this.manifest_render.x3dLib.SFFloat(0.5);
            container.push(light);        
        });
    }
    
    private addAnnotation(container, anno:manifesto.Annotation):void {
        console.debug(`enter SceneRender.addAnnotation ${anno.id}`);
        try{
            const body:manifesto.JSONLDResource = ( ():manifesto.JSONLDResource =>{
                const rv: manifesto.JSONLDResource | null = anno.Body;
                if (rv == null){
                    const msg = `SceneRender.addAnnotation | no body property`;
                    throw new Error(msg);
                }
                return rv as manifesto.JSONLDResource
            })();
            
            const bodySource:manifesto.ManifestResource = thisOrSource(body);
            const target = anno.Target;
            
            //if (bodySource instanceof manifesto.Model)
            if ((bodySource as any).isModel )
                return this.addModel(container, anno);
    
            if ((bodySource as any).isCamera )
                return this.addCamera(container, anno);
                
            console.warn(`unsupported body type`);
            return;
        } catch(error) {
            const msg = `SceneRender.addAnnotation : failed with ${error}`;
            console.error(msg);
            return;
        }
    }
    
    /*
    Developer Note Mar 23 2026
    For code readability this function has been separated into a separate method;
    but there is a precontract condition that the annotation.body has already been
    determined to be a model
    */
    private addModel(container: any , anno : manifesto.Annotation ):void{
               
        // precontract check
        const model:manifesto.Model = (():manifesto.Model => {
            const test:any = thisOrSource( anno.Body );
            if (test == null || ! test.isModel )
                throw new Error(`SceneRender.addMode: precontract violation: not a model`);
            return test as manifesto.Model;
        })();
             
        console.debug(`adding model ${model.id}`);
        
        const inline = this.createNode("Inline");
        inline.url = new this.manifest_render.x3dLib.MFString( model.id );
            
        const net_transforms =  [   ...TransformsForBody(anno.Body),
                                    TranslationForTarget(anno.Target) ];
                                      
        const placements = transformsToPlacements( net_transforms );
                
        const outerNode = placements.reduce( (accum: WrappedInline, placement: Placement):WrappedInline => {
                const newNode = this.createTransformNode(placement);
                if (newNode != null){
                    newNode.children.push(accum);
                    return newNode;
                }
                return accum;
            }, inline);        
        console.info(`model fragment ${outerNode.toXMLString()}`);
        container.push(outerNode);
        return;                       
    }

    /*
    Developer Note Mar 23 2026
    For code readability this function has been separated into a separate method;
    but there is a precontract condition that the annotation.body has already been
    determined to be a camera
    
    Developer Note Mar 23 2026
    The Presentation 4 Spec editors have not clarified what would be the
    meaning of a Camera with  lookAt property subject to transforms from
    a SpecificResource wrapping. 
    */

    private addCamera(  container, anno : manifesto.Annotation):void{

        // precontract check
        const camera:manifesto.Camera = (():manifesto.Camera => {
            const test:any = thisOrSource( anno.Body );
            if (test == null || ! test.isCamera )
                throw new Error(`SceneRender.addCamera: precontract violation: not a camera`);
            return test as manifesto.Camera;
        })();
        
        // lookAt vs SpecificResource check
        if ((anno.Target as any).isSpecificResource && (camera.LookAt != null))
        {
            const msg:string = `SceneRender.addCamera | case of lookAt wrapped in SpecificResource not implemented`;
            throw new Error()
        }
        
        
                
        const camera_placement:Placement = ( () => {
            const placements =  transformsToPlacements(
                [   ...TransformsForBody(anno.Body),
                    TranslationForTarget(anno.Target) ]);
            if (placements.length > 1){
                console.warn(`invalid transforms for Camera body`);
            }
            return placements[0];
        })();                   
        
        
        const cameraLocation : Translation  =   camera_placement.translation;
            
        const [cameraOrientation, cameraCenter]  = ( (lookAt):[Rotation, Translation] => {
            if (lookAt == null){
                return [ camera_placement.rotation,TranslationForTarget(anno.Target)];
            }
            if ((lookAt as any).isPointSelector){
                const lookAtLocation:Translation = 
                    Transform.from_point_selector( lookAt as manifesto.PointSelector);                
                const camera_rotation = (():Rotation =>{
                    const rvn = relativeRotation(cameraLocation, lookAtLocation);
                    if (rvn == null)
                        throw new Error(`SceneRender.addCamera : lookAt same place as camera`);
                    return rvn as Rotation
                })();
                return [ camera_rotation, lookAtLocation];
            }
            const msg = `SceneRender.addCamera | unsupported lookAt resource`;
            throw new Error(msg);
        })();
        
        
        const cameraNode = (() => {
            if (camera.isPerspectiveCamera){
                const retVal = this.createNode("Viewpoint");
                const fov = (camera.FieldOfView ?? 45.0) * (Math.PI/180.0); // in radians
                retVal.fieldOfView = new this.manifest_render.x3dLib.SFFloat(fov);
                return retVal;
            }
            throw new Error(`SceneRender.buildCameraNode unsupported camera`);       
        })();
        
        cameraNode.orientation = new this.manifest_render.x3dLib.SFRotation(...cameraOrientation.x3dArgs);
        
        cameraNode.position = new this.manifest_render.x3dLib.SFVec3f(...cameraLocation.x3dArgs);
        
        cameraNode.centerOfRotation = new this.manifest_render.x3dLib.SFVec3f(...cameraCenter.x3dArgs);
        
        container.push( cameraNode );
        return;
    }
    
    createTransformNode(placement : Placement):X3D.ConcreteNodeTypes["Transform"] | null {
        let nullFlag : boolean = true;
        const retVal:X3D.ConcreteNodeTypes["Transform"] = this.createNode("Transform");
        if (!placement.rotation.isIdentity(1.0e-6)){
            nullFlag = false;
            retVal.rotation = new this.manifest_render.x3dLib.SFRotation(...placement.rotation.x3dArgs);
        }
        
        if (!placement.translation.isIdentity(1.0e-6)){
            nullFlag = false;
            retVal.translation = new this.manifest_render.x3dLib.SFVec3f(...placement.translation.x3dArgs);
        }
        
        if (!placement.scaling.isIdentity(1.0e-6)){
            nullFlag = false;
            retVal.scale = new this.manifest_render.x3dLib.SFVec3f(...placement.scaling.x3dArgs);
        }
        if (nullFlag) return null;
        return retVal;
    }
}