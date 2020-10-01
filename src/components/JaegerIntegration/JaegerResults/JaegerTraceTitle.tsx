import * as React from 'react';
import { CardHeader, Text, TextVariants } from '@patternfly/react-core';
import { PfColors } from '../../Pf/PfColors';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { FormattedTraceInfo, fullIDStyle } from './FormattedTraceInfo';
import { Link } from 'react-router-dom';

interface Props {
  formattedTrace: FormattedTraceInfo;
  externalURL?: string;
  graphURL: string;
}

export class JaegerTraceTitle extends React.Component<Props> {
  render() {
    const { formattedTrace } = this.props;
    return (
      <CardHeader style={{ backgroundColor: PfColors.Black200, height: '50px' }}>
        <Text component={TextVariants.h3} style={{ margin: 0, position: 'relative' }}>
          {formattedTrace.name()}
          <span className={fullIDStyle}>{formattedTrace.fullID()}</span>
          {' - '}
          <Link to={this.props.graphURL}>View on Graph</Link>
          {this.props.externalURL && (
            <>
              {' - '}
              <a href={this.props.externalURL} target={'_blank'} rel="noopener noreferrer">
                View Trace in Tracing <ExternalLinkAltIcon />
              </a>
            </>
          )}
          <span style={{ float: 'right', position: 'relative' }}>
            {formattedTrace.relativeDate()}
            <span style={{ padding: '0 10px 0 10px' }}>|</span>
            {formattedTrace.absTime()} ({formattedTrace.fromNow()})
          </span>
        </Text>
      </CardHeader>
    );
  }
}
