import {manifesto} from "@kshell/manifesto-prezi4";

export IManifestoOptions = manifesto.IManifestoOptions;

export defaultManifestoOptions:IManifestoOptions =
{
  defaultLabel: string = "";
  index?: number = null;
  locale: string = "en";
  navDate?: Date;
  pessimisticAccessControl: boolean; = true;
  resource: IIIFResource;
};