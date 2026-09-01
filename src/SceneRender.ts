import * as manifesto from "@kshell/manifesto-prezi4";
import {IManifestRender} from "./Manifest3DViewer.js";
import {Transform, 
        transformsToPlacements, 
        Rotation, 
        Translation, 
        Placement, 
        relativeRotation,
        directionFromOrientation,
        directionFromDisplacement } from "@kshell/iiif-x3d-transforms";
        
import {Vector3} from "threejs-math";

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
    isHouseLightsOn? : boolean;  
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
    
    
    
    public constructor( scene : manifesto.Scene, manifest_render:IManifestRender){        
        this.manifest_render = manifest_render;
        this.scene_properties = scene;
        
        if ( this.manifest_render.x3dLib == undefined ){
            throw new Error("global this.manifest_render.x3dLib not defined in SceneRender.constuctor");
        }
    };
    
    private scene_x3d?: X3D.X3DScene;
    
    private createNode( tag:string ) {
        if (this.scene_x3d == null){
            throw new Error("SceneRender.createNode: scene_node not initialized");
        }
        console.debug(`SceneRender.createNode ${tag}`);
        return this.scene_x3d.createNode(tag);
    }
    
    private navigationInfo?      : X3D.ConcreteNodeTypes["NavigationInfo"];
    private defaultLightsSwitch? : X3D.ConcreteNodeTypes["Switch"];
    
    get isHouseLightsOn():boolean | undefined {
        if ( this.navigationInfo === undefined) return undefined;
        return this.navigationInfo.headlight;
    }
    
    set isHouseLightsOn(value:boolean){
        if (this.navigationInfo != null)
            this.navigationInfo.headlight = value;
        if (this.defaultLightsSwitch != null)
            this.defaultLightsSwitch.whichChoice = (value)?0:-1;
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
        
        if (this.scene_x3d != null){
            this.addNavigationInfo(  this.scene_x3d.rootNodes );
            this.addDefaultLighting( this.scene_x3d.rootNodes );
            this.addBackground(      this.scene_x3d.rootNodes );
            
            this.scene_properties.Items.forEach( (page:manifesto.AnnotationPage) => {
                if (this.scene_x3d != null)
                    this.addAnnotationPage(this.scene_x3d.rootNodes, page);
            });
            
            await this.manifest_render.browser.replaceWorld(this.scene_x3d); 
        }
        //await render_stub_content(this.browser);
        
        
        return this as SceneHooks
    }
    
    private addNavigationInfo(container):void {
        const navInfo = this.createNode("NavigationInfo") as X3D.ConcreteNodeTypes["NavigationInfo"]
        navInfo.headlight = true;
        this.navigationInfo = navInfo;
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
                                
        const backGround = this.createNode("Background") as X3D.ConcreteNodeTypes["Background"];
        backGround.skyColor = new this.manifest_render.x3dLib.MFColor(
            new this.manifest_render.x3dLib.SFColor(...rgb)
        );
        container.push(backGround);
    }
    
    private addAnnotationPage(container, page: manifesto.AnnotationPage):void {
        const group  = this.createNode("Group") as X3D.ConcreteNodeTypes["Group"];
        page.Items.forEach( (anno:manifesto.Annotation):void => {
            this.addAnnotation( group.children , anno );
        });
        container.push(group);
    }
    
    private addDefaultLighting(container):void {
        const switchNode = this.createNode("Switch") as X3D.SwitchProxy;
        const groupNode  = this.createNode("Group")  as X3D.GroupProxy;
        const directionData : AxesValues[] 
            =   [ [0.0 , -0.81649658, -0.57735027] ,
                [-0.5, -0.81649658,  0.28867513],
                [+0.5, -0.81649658,  0.28867513]];
        directionData.forEach( (vec:AxesValues) => {
            const light = this.createNode("DirectionalLight") as X3D.DirectionalLightProxy;
            light.direction = new this.manifest_render.x3dLib.SFVec3f(...vec);
            light.global =    true;
            light.intensity = 1.0 ;
            light.ambientIntensity = 0.5;
            groupNode.children.push(light);        
        });
        switchNode.children.push(groupNode);
        switchNode.whichChoice = 0;
        this.defaultLightsSwitch = switchNode;
        container.push(switchNode);
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
                
            if ((bodySource as any).isSpotLight )
                return this.addSpotLight(container, anno);
                
            console.warn(`unsupported body type ${body.ResourceType}`);
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
        
        const inline = this.createNode("Inline") as X3D.InlineProxy;
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
        console.info(`model fragment \n${outerNode.toXMLString()}`);
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
        if ((anno.Body as any).isSpecificResource && (camera.LookAt != null))
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
            console.debug(`addCamera: lookAt: ${lookAt}`);
            if (lookAt == null){
                return [ camera_placement.rotation,TranslationForTarget(anno.Target)];
            }
            else {
                const lookAtLocation:Translation = 
                    this.translation_from_lookat(lookAt as manifesto.JSONLDResource);
                                   
                const camera_rotation = (():Rotation =>{
                    console.debug(`camera_rotation from ${cameraLocation} to ${lookAtLocation}`);
                    const rvn = relativeRotation(lookAtLocation, cameraLocation );
                    if (rvn == null)
                        throw new Error(`SceneRender.addCamera : lookAt same place as camera`);
                    return rvn as Rotation
                })();
                return [ camera_rotation, lookAtLocation];
            }
        })( camera.LookAt );
        
        
        const cameraNode = (() => {
            if (camera.isPerspectiveCamera){
                const retVal = this.createNode("Viewpoint") as X3D.ViewpointProxy;
                const fov = (camera.FieldOfView ?? 45.0) * (Math.PI/180.0); // in radians
                retVal.fieldOfView = fov;
                return retVal;
            }
            throw new Error(`SceneRender.buildCameraNode unsupported camera`);       
        })();
        
        cameraNode.orientation = new this.manifest_render.x3dLib.SFRotation(...cameraOrientation.x3dArgs);
        
        cameraNode.position = new this.manifest_render.x3dLib.SFVec3f(...cameraLocation.x3dArgs);
        
        cameraNode.centerOfRotation = new this.manifest_render.x3dLib.SFVec3f(...cameraCenter.x3dArgs);
        
        console.info(`camera fragment \n${cameraNode.toXMLString()}`);
        container.push( cameraNode );
        return;
    }
    
    
    private addSpotLight(  container, anno : manifesto.Annotation):void{
        // precontract check
        const spotlight:manifesto.SpotLight = (():manifesto.SpotLight => {
            const test:any = thisOrSource( anno.Body );
            if (test == null || ! test.isSpotLight )
                throw new Error(`SceneRender.addSpotLight: precontract violation: not a spotlight`);
            return test as manifesto.SpotLight;
        })();
        
        // lookAt vs SpecificResource check
        if ((anno.Body as any).isSpecificResource && (spotlight.LookAt != null))
        {
            const msg:string = `SceneRender.addSpotLight | case of lookAt wrapped in SpecificResource not implemented`;
            throw new Error(msg);
        }
                
        const light_placement:Placement = ( () => {
            const placements =  transformsToPlacements(
                [   ...TransformsForBody(anno.Body),
                    TranslationForTarget(anno.Target) ]);
            if (placements.length > 1){
                console.warn(`invalid transforms for Camera body`);
            }
            return placements[0];
        })();                   
        
        
        const lightLocation : Translation  =   light_placement.translation;
            
        const lightDirection  = ( (lookAt):Translation  => {
            if (lookAt == null){
                return directionFromOrientation(light_placement.rotation);
            }
            if ((lookAt as any).isPointSelector){
                const lookAtLocation:Translation = 
                    Transform.from_point_selector( lookAt as manifesto.PointSelector);              
                const dir = directionFromDisplacement(lightLocation,lookAtLocation);
                if (dir == null){
                    const msg = `SceneRender.addSpotLight | light and lookAt at same location`;
                    throw new Error(msg);
                }
                return dir as Translation;
            }
            const msg = `SceneRender.addSpotLight | unsupported lookAt resource`;
            throw new Error(msg);
        })(spotlight.LookAt);

        const lightNode =  this.createNode("SpotLight") as X3D.SpotLightProxy;

        const lightColor:X3DColor = X3DColor.from_manifesto_color( spotlight.Color);
        lightNode.color =   new this.manifest_render.x3dLib.SFColor(...lightColor.x3dArgs);  
        
        const lightIntensity:number = (():number => {
            const valueInstance = spotlight.Intensity;
            if (valueInstance == null){
                const msg=`SceneRender.addSpotLight | intensity not specified, default to 1.0`;
                console.warn(msg);
                return 1.0;
            }
            return valueInstance.QuantityValue;
        })();   
        lightNode.intensity = lightIntensity;
        
        const angle_degrees = spotlight.Angle ?? 15.0;
        const angle = Math.max(0.0, Math.min( Math.PI/2, angle_degrees * Math.PI/180.0));
        lightNode.beamWidth   = angle;
        lightNode.cutOffAngle = angle;
        
        lightNode.direction = new this.manifest_render.x3dLib.SFVec3f(...lightDirection.x3dArgs);
        
        lightNode.location = new this.manifest_render.x3dLib.SFVec3f(...lightLocation.x3dArgs);
        
        console.info(`light fragment \n${lightNode.toXMLString()}`);
        container.push( lightNode );
        return;
    }
    
    createTransformNode(placement : Placement):X3D.ConcreteNodeTypes["Transform"] | null {
        let nullFlag : boolean = true;
        const retVal:X3D.ConcreteNodeTypes["Transform"] = this.createNode("Transform") as X3D.TransformProxy;
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
    
    /*
    Developer Note: 20260427 intention is that this function will handle these cases
    1. lookAt is a PointSelector
    2. lookAt is an annotation in th that also targets this scene
    3. 2 but wrapped in a SpecificResource whose selector is a PointSelector
    */
    private translation_from_lookat( lookAt:manifesto.JSONLDResource) : Translation {
        const lookAtType:string = lookAt.ResourceType;
        if (lookAtType == "PointSelector"){
            return Transform.from_manifesto_transform(lookAt as manifesto.PointSelector) as Translation;
        }
        if (lookAtType == "Annotation"){
            const lookat_anno_id = lookAt.ResourceId;
            const found_anno : manifesto.Annotation | null = 
                this.manifest_render.manifest.findAnnotationById( lookat_anno_id );
                
            if (found_anno == null){
                const msg:string = `SceneRender.translation_from_lookat : resource ${lookat_anno_id} not found`;
                throw new Error(msg);
            }
            else{
                {
                    const msg:string = `SceneRender.translation_from_lookat : resource ${lookat_anno_id} found`;
                    console.log(msg);
                }
                const lookAtTargetSource = thisOrSource(found_anno.Target);
                console.debug(`lookAtTargetSource ${lookAtTargetSource.ResourceId}`);
                if ( lookAtTargetSource.ResourceId != this.scene_properties.ResourceId ){
                    const msg = "SceneRender.translation_from_lookat | target mismatch: " +
                                `${lookAtTargetSource.ResourceId} to ${this.scene_properties.ResourceId}`;
                    throw new Error(msg);
                }
               
                return TranslationForTarget( found_anno.Target);
            }
        }
        const msg = `SceneRender.translation_from_lookat | unsupport type ${lookAtType}`;
        throw new Error(msg);
    }
}


/*
class to wrap around a manifesto.Color instance to provide the interface to 
X3D Color node
*/
class X3DColor {
    readonly values:[number,number,number];
    
    constructor( _values: [number,number,number]){
        this.values = _values;
    }
    
    get x3dArgs():[number,number,number]{
        return this.values;
    }
    
    static from_manifesto_color( c : { red:number, green:number, blue:number } ){
        const conv = [c.red,c.green,c.blue].map( (v:number):number => 
        {
            return Math.min(1.0, Math.max(0.0, (v-0.5)/254.0));
        });
        return new X3DColor(conv as [number,number,number]);
    }
    
    static readonly WHITE = new X3DColor([1.0,1.0,1.0]);
}