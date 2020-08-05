import { DurationInSeconds } from './Common';

export type IstioLabelKey = 'appLabelName' | 'versionLabelName' | 'injectionLabelName';

// 3scale public config, typically to check if addon/extension is enabled
interface ThreeScaleConfig {
  adapterName: string;
  adapterPort: string;
  adapterService: string;
  enabled: boolean;
  templateName: string;
}
interface iter8Config {
  enabled: boolean;
}
// Kiali addons/extensions specific
interface Extensions {
  threescale: ThreeScaleConfig;
  iter8: iter8Config;
}

export interface ServerConfig {
  extensions?: Extensions;
  installationTag?: string;
  istioIdentityDomain: string;
  istioNamespace: string;
  istioComponentNamespaces?: Map<string, string>;
  istioInjectionAction: boolean;
  istioLabels: { [key in IstioLabelKey]: string };
  prometheus: {
    globalScrapeInterval?: DurationInSeconds;
    storageTsdbRetention?: DurationInSeconds;
  };
  istioTelemetryV2: boolean;
}
