import * as React from 'react';
import { Icon } from 'patternfly-react';
import {
  checkForPath,
  globalChecks,
  highestSeverity,
  severityToColor,
  severityToIconName,
  validationToSeverity
} from '../../../types/ServiceInfo';
import { Host, ObjectValidation, VirtualService } from '../../../types/IstioObjects';
import LocalTime from '../../../components/Time/LocalTime';
import DetailObject from '../../../components/Details/DetailObject';
import VirtualServiceRoute from './VirtualServiceRoute';
import { Link } from 'react-router-dom';
import { Card, CardBody, Grid, GridItem } from '@patternfly/react-core';

interface VirtualServiceProps {
  namespace: string;
  virtualService: VirtualService;
  validation?: ObjectValidation;
}

class VirtualServiceDetail extends React.Component<VirtualServiceProps> {
  validation(_virtualService: VirtualService): ObjectValidation | undefined {
    return this.props.validation;
  }

  globalStatus(rule: VirtualService) {
    const validation = this.validation(rule);
    if (!validation) {
      return '';
    }

    const checks = globalChecks(validation);
    const severity = validationToSeverity(validation);
    const iconName = severityToIconName(severity);
    const color = severityToColor(severity);
    let message = checks.map(check => check.message).join(',');

    if (!message.length) {
      if (validation && !validation.valid) {
        message = 'Not all checks passed!';
      }
    }

    if (message.length) {
      return (
        <div>
          <p style={{ color: color }}>
            <Icon type="pf" name={iconName} /> {message}
          </p>
        </div>
      );
    } else {
      return '';
    }
  }

  hostStatusMessage(virtualService: VirtualService) {
    const checks = checkForPath(this.validation(virtualService), 'spec/hosts');
    const severity = highestSeverity(checks);

    return {
      message: checks.map(check => check.message).join(','),
      icon: severityToIconName(severity),
      color: severityToColor(severity)
    };
  }

  parseHost(host: string): Host {
    if (host.includes('/')) {
      const gatewayParts = host.split('/');
      return {
        service: gatewayParts[1],
        namespace: gatewayParts[0]
      };
    }

    const hostParts = host.split('.');
    const h = {
      service: hostParts[0],
      namespace: this.props.namespace
    };

    if (hostParts.length > 1) {
      h.namespace = hostParts[1];
    }

    return h;
  }

  generateGatewaysList(gateways: string[]) {
    const childrenList: any = [];
    Object.keys(gateways).forEach((key, j) => {
      const host = this.parseHost(gateways[key]);
      childrenList.push(
        <li key={'gateway_' + host.service + '_' + j}>
          {host.service === 'mesh' ? (
            host.service
          ) : (
            <Link to={`/namespaces/${host.namespace}/istio/gateways/${host.service}`}>{gateways[key]}</Link>
          )}
        </li>
      );
    });

    return (
      <div>
        <strong className="text-capitalize">Gateways</strong>
        <ul className={'details'}>{childrenList}</ul>
      </div>
    );
  }

  rawConfig() {
    const virtualService: VirtualService = this.props.virtualService;

    return (
      <GridItem>
        <Card key={'virtualServiceConfig'}>
          <CardBody>
            <h4>Virtual Service Overview</h4>
            <div>{this.globalStatus(virtualService)}</div>
            <div>
              <strong>Created at</strong>: <LocalTime time={virtualService.metadata.creationTimestamp || ''} />
            </div>
            <div>
              <strong>Resource Version</strong>: {virtualService.metadata.resourceVersion}
            </div>
            {virtualService.spec.hosts && virtualService.spec.hosts.length > 0 ? (
              <DetailObject
                name="Hosts"
                detail={virtualService.spec.hosts}
                validation={this.hostStatusMessage(virtualService)}
              />
            ) : (
              undefined
            )}
            {virtualService.spec.gateways && virtualService.spec.gateways.length > 0
              ? this.generateGatewaysList(virtualService.spec.gateways)
              : undefined}
          </CardBody>
        </Card>
      </GridItem>
    );
  }

  weights() {
    const virtualService: VirtualService = this.props.virtualService;
    const protocols = [
      { name: 'HTTP', object: virtualService.spec.http },
      { name: 'TCP', object: virtualService.spec.tcp },
      { name: 'TLS', object: virtualService.spec.tls }
    ];

    return protocols.map((protocol, i) => {
      const { name, object } = protocol;
      if (object && object.length > 0) {
        return (
          <GridItem key={'virtualserviceroute-grid' + i}>
            <Card>
              <CardBody>
                <VirtualServiceRoute
                  name={virtualService.metadata.name}
                  namespace={virtualService.metadata.namespace || ''}
                  kind={name}
                  routes={object}
                  validation={this.props.validation}
                />
              </CardBody>
            </Card>
          </GridItem>
        );
      } else {
        return undefined;
      }
    });
  }

  render() {
    return (
      <div className="container-fluid container-cards-pf">
        <Grid gutter={'md'}>
          {this.rawConfig()}
          {this.weights()}
        </Grid>
      </div>
    );
  }
}

export default VirtualServiceDetail;
