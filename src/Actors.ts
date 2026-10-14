import {SceneRender, SceneHooks } from "./SceneRender.js";
import type X3D from "x_ite";

export class Actors {

    static Viewpoint( annotationId : string , scene:SceneRender ){
        return ( (action:string) => {
            console.debug(`Actors.Viewpoint: action {action} on {annotationId}`);
            const viewpoint = scene.viewpoints[annotationId];
            if (viewpoint == null){
                console.warn(`Actor.Viewpoint called with invalid id {annotationId}`);
                return;
            }
            if (action == "show"){
                (viewpoint as X3D.ViewpointProxy).set_bind = true;
            }
            if (action == "hide"){
                (viewpoint as X3D.ViewpointProxy).set_bind = false;
            }
        });  
    }
}