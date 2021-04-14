import * as React from 'react';
import { Workload } from '../../types/Workload';
import { Badge, Card, CardBody, CardHeader, Title, Tooltip, TooltipPosition } from '@patternfly/react-core';
import DetailDescription from '../../components/Details/DetailDescription';
import { serverConfig } from '../../config';
import { style } from 'typestyle';
import Labels from '../../components/Label/Labels';
import LocalTime from '../../components/Time/LocalTime';
import { TextOrLink } from '../../components/TextOrLink';
import { renderAPILogo, renderRuntimeLogo } from '../../components/Logo/Logos';
import * as H from '../../types/Health';
import { AppWorkload } from '../../types/App';
import { KialiIcon } from '../../config/KialiIcon';

type WorkloadDescriptionProps = {
  workload?: Workload;
  health?: H.Health;
  namespace: string;
};

const resourceListStyle = style({
  margin: '0px 0 11px 0',
  $nest: {
    '& > ul > li > span': {
      float: 'left',
      width: '125px',
      fontWeight: 700
    }
  }
});

const iconStyle = style({
  display: 'inline-block',
  verticalAlign: '2px !important'
});

const infoStyle = style({
  margin: '0px 5px 2px 10px',
  verticalAlign: '-6px !important'
});

class WorkloadDescription extends React.Component<WorkloadDescriptionProps> {
  render() {
    const workload = this.props.workload;
    const apps: string[] = [];
    const services: string[] = [];
    const workloads: AppWorkload[] = [];

    if (workload) {
      if (workload.labels[serverConfig.istioLabels.appLabelName]) {
        apps.push(workload.labels[serverConfig.istioLabels.appLabelName]);
      }
      workload.services.forEach(s => services.push(s.name));
      workloads.push({
        workloadName: workload.name,
        istioSidecar: workload.istioSidecar
      });
    }
    const isTemplateLabels =
      workload &&
      ['Deployment', 'ReplicaSet', 'ReplicationController', 'DeploymentConfig', 'StatefulSet'].indexOf(workload.type) >=
        0;
    const runtimes = (workload?.runtimes || []).map(r => r.name).filter(name => name !== '');

    const workloadProperties = workload ? (
      <>
        <div key="properties-list" className={resourceListStyle}>
          <ul style={{ listStyleType: 'none' }}>
            {workload.istioInjectionAnnotation !== undefined && (
              <li>
                <span>Istio Injection</span>
                {String(workload.istioInjectionAnnotation)}
              </li>
            )}
            <li>
              <span>Type</span>
              {workload.type ? workload.type : 'N/A'}
            </li>
            <li>
              <span>Created</span>
              <div style={{ display: 'inline-block' }}>
                <LocalTime time={workload.createdAt} />
              </div>
            </li>
            <li>
              <span>Version</span>
              {workload.resourceVersion}
            </li>
            {workload.additionalDetails.map((additionalItem, idx) => {
              return (
                <li key={'additional-details-' + idx} id={'additional-details-' + idx}>
                  <span>{additionalItem.title}</span>
                  {additionalItem.icon && renderAPILogo(additionalItem.icon, undefined, idx)}
                  <TextOrLink text={additionalItem.value} urlTruncate={64} />
                </li>
              );
            })}
            {runtimes.length > 0 && (
              <li id="runtimes">
                <span>Runtimes</span>
                <div style={{ display: 'inline-block' }}>
                  {runtimes
                    .map((rt, idx) => renderRuntimeLogo(rt, idx))
                    .reduce(
                      (list: JSX.Element[], elem) =>
                        list.length > 0 ? [...list, <span key="sep"> | </span>, elem] : [elem],
                      []
                    )}
                </div>
              </li>
            )}
          </ul>
        </div>
      </>
    ) : undefined;

    return workload ? (
      <Card>
        <CardHeader>
          <Title headingLevel="h5" size="lg">
            <div key="service-icon" className={iconStyle}>
              <Tooltip position={TooltipPosition.top} content={<>Workload</>}>
                <Badge className={'virtualitem_badge_definition'}>W</Badge>
              </Tooltip>
            </div>
            {this.props.workload ? this.props.workload.name : 'Workload'}
            {workloadProperties ? (
              <Tooltip
                position={TooltipPosition.right}
                content={<div style={{ textAlign: 'left' }}>{workloadProperties}</div>}
              >
                <KialiIcon.Info className={infoStyle} />
              </Tooltip>
            ) : undefined}
          </Title>
        </CardHeader>
        <CardBody>
          {workload.labels && (
            <Labels
              labels={workload.labels}
              tooltipMessage={isTemplateLabels ? 'Labels defined on the Workload template' : undefined}
            />
          )}
          <DetailDescription
            namespace={this.props.namespace}
            apps={apps}
            services={services}
            workloads={workloads}
            health={this.props.health}
          />
        </CardBody>
      </Card>
    ) : (
      'Loading'
    );
  }
}

export default WorkloadDescription;