# @kshell/manifest-viewer

Typescript package to support adding a IIIF Manifest 3D viewer, implemented using the X_ITE X3D browser, to a webpage. The intended configuration is that this will be a subpackage of a Node package which will built a webpage using a packager such as Parceljs, so that the code in this repository will be transpiled to Javascript and bundled into the webpage contents.

## Dependencies

* @kshell/manifesto-prezi4 Package that wraps the Javascript object created by JSON decoding a IIIF Manifest file. 
    * Github repository: [vincentmarchetti/manifesto-prezi4](https://github.com/vincentmarchetti/manifesto-prezi4)
    
* @@kshell/iiif-x3d-transforms Package that extends the classes defined in @kshell/manifesto-prezi4 to deliver X3D specific geometric values.
    * Github repository: [vincentmarchetti/iiif-x3d-transforms](https://github.com/vincentmarchetti/iiif-x3d-transforms)
    
* x_ite : Code for the X_ITE X3D browser. Only Typescript type information is imported into the @kshell/manifest-viewer code at transpile time.
    * npm package [x_ite](https://www.npmjs.com/package/x_ite)
    * Github repository [create3000/x_ite](https://github.com/create3000/x_ite)
    
* threejs-math : Code providing geometric computation, particularly for representation of rotations in quaternion, euler, or axis-angle forms.
    * npm package [threejs-math](https://www.npmjs.com/package/threejs-math)

