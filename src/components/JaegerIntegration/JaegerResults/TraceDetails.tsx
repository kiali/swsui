import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import {
  Button,
  ButtonVariant,
  Card,
  CardBody,
  Grid,
  GridItem,
  Label,
  pluralize,
  Tooltip
} from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';

import { JaegerTrace } from '../../../types/JaegerInfo';
import { JaegerTraceTitle } from './JaegerTraceTitle';
import { CytoscapeGraphSelectorBuilder } from 'components/CytoscapeGraph/CytoscapeGraphSelector';
import { GraphType, NodeType } from 'types/Graph';
import { FormattedTraceInfo, shortIDStyle } from './FormattedTraceInfo';
import { formatDuration } from './transform';
import { PFAlertColor } from 'components/Pf/PfColors';
import { KialiAppState } from 'store/Store';
import { KialiAppAction } from 'actions/KialiAppAction';
import { JaegerThunkActions } from 'actions/JaegerThunkActions';
import { getTraceId } from 'utils/SearchParamUtils';
import { average } from 'utils/MathUtils';
import { averageSpanDuration, isSimilarTrace } from 'utils/TraceStats';

interface Props {
  otherTraces: JaegerTrace[];
  jaegerURL: string;
  namespace: string;
  target: string;
  targetKind: 'app' | 'workload' | 'service';
  setTraceId: (traceId?: string) => void;
  trace?: JaegerTrace;
}

interface State {}

class TraceDetails extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const urlTrace = getTraceId();
    if (urlTrace && urlTrace !== props.trace?.traceID) {
      props.setTraceId(urlTrace);
    }
  }

  private getGraphURL = (traceID: string) => {
    let cytoscapeGraph = new CytoscapeGraphSelectorBuilder().namespace(this.props.namespace);
    let graphType: GraphType = GraphType.APP;

    switch (this.props.targetKind) {
      case 'app':
        cytoscapeGraph = cytoscapeGraph.app(this.props.target).nodeType(NodeType.APP).isGroup(null);
        break;
      case 'service':
        graphType = GraphType.SERVICE;
        cytoscapeGraph = cytoscapeGraph.service(this.props.target);
        break;
      case 'workload':
        graphType = GraphType.WORKLOAD;
        cytoscapeGraph = cytoscapeGraph.workload(this.props.target);
        break;
    }

    return `/graph/namespaces?graphType=${graphType}&injectServiceNodes=true&namespaces=${
      this.props.namespace
    }&traceId=${traceID}&focusSelector=${encodeURI(cytoscapeGraph.build())}`;
  };

  render() {
    const { trace, otherTraces, jaegerURL } = this.props;
    if (!trace) {
      return null;
    }
    const formattedTrace = new FormattedTraceInfo(trace);

    // Compute a bunch of stats
    const services = new Set();
    trace.spans.forEach(s => services.add(s.process.serviceName));
    const differentServices = services.size;
    const otherMeanDuration = average(otherTraces, trace => trace.duration);
    const avgSpanDuration = averageSpanDuration(trace);
    const otherSpanDurations = otherTraces.map(t => averageSpanDuration(t)).filter(d => d !== undefined) as number[];
    const otherMeanAvgSpanDuration = average(otherSpanDurations, d => d);
    const similarTraces = otherTraces.filter(t => t.traceID !== trace.traceID && isSimilarTrace(t, trace));
    const similarMeanDuration = average(similarTraces, trace => trace.duration);
    const similarSpanDurations = similarTraces
      .map(t => averageSpanDuration(t))
      .filter(d => d !== undefined) as number[];
    const similarMeanAvgSpanDuration = average(similarSpanDurations, d => d);
    const comparisonLink =
      this.props.jaegerURL && similarTraces.length > 0
        ? `${this.props.jaegerURL}/trace/${trace.traceID}...${similarTraces[0].traceID}?cohort=${
            trace.traceID
          }${similarTraces
            .slice(0, 10)
            .map(t => `&cohort=${t.traceID}`)
            .join('')}`
        : undefined;

    return (
      <Card isCompact style={{ border: '1px solid #e6e6e6' }}>
        <JaegerTraceTitle
          formattedTrace={formattedTrace}
          externalURL={jaegerURL ? `${jaegerURL}/trace/${trace.traceID}` : undefined}
          graphURL={this.getGraphURL(trace.traceID)}
        />
        <CardBody>
          <Grid style={{ marginTop: '20px' }}>
            <GridItem span={3}>
              <Label style={{ margin: 10 }}>{pluralize(trace.spans.length, 'Span')}</Label>
              <Label
                style={{
                  margin: 10,
                  backgroundColor: formattedTrace.hasErrors() ? PFAlertColor.Danger : PFAlertColor.Success
                }}
              >
                {pluralize(formattedTrace.numErrors, 'Span')} with error
              </Label>
              <br />
              <Label style={{ margin: 10 }}>{pluralize(differentServices, 'App')} involved</Label>
            </GridItem>
            <GridItem span={3}>
              <Tooltip content={<>The full trace duration is (trace end time) - (trace start time).</>}>
                <strong>Full duration: </strong>
              </Tooltip>
              {formatDuration(trace.duration)}
              <br />
              <small style={{ paddingLeft: 15 }}>
                versus similar mean:{' '}
                {comparedDurations(trace.duration, similarMeanDuration, formattedTrace.shortID(), 'similar')}
              </small>
              <br />
              <small style={{ paddingLeft: 15 }}>
                versus all others mean:{' '}
                {comparedDurations(trace.duration, otherMeanDuration, formattedTrace.shortID(), 'others')}
              </small>
              <br />
              <Tooltip
                content={
                  <>
                    The average duration of all spans within the trace. It differs from full duration, as spans can run
                    in parallel, or there can be dead time between spans.
                  </>
                }
              >
                <strong>Spans average duration: </strong>
              </Tooltip>
              {avgSpanDuration ? formatDuration(avgSpanDuration) : 'n/a'}
              <br />
              <small style={{ paddingLeft: 15 }}>
                versus similar mean:{' '}
                {comparedDurations(avgSpanDuration, similarMeanAvgSpanDuration, formattedTrace.shortID(), 'similar')}
              </small>
              <br />
              <small style={{ paddingLeft: 15 }}>
                versus all others mean:{' '}
                {comparedDurations(avgSpanDuration, otherMeanAvgSpanDuration, formattedTrace.shortID(), 'others')}
              </small>
              <br />
            </GridItem>
            <GridItem span={6}>
              <strong>Similar traces</strong>
              {comparisonLink && (
                <>
                  {' - '}
                  <a href={comparisonLink} target={'_blank'} rel="noopener noreferrer">
                    Compare in Tracing <ExternalLinkAltIcon />
                  </a>
                </>
              )}
              <ul>
                {similarTraces.length > 0
                  ? similarTraces.slice(0, 3).map(t => {
                      const info = new FormattedTraceInfo(t);
                      return (
                        <li key={t.traceID}>
                          <Button
                            style={{ paddingLeft: 0, paddingRight: 3 }}
                            variant={ButtonVariant.link}
                            onClick={() => this.props.setTraceId(t.traceID)}
                          >
                            {info.name()}
                          </Button>
                          <span className={shortIDStyle}>{info.shortID()}</span>
                          <small>
                            ({info.fromNow()},{' '}
                            {comparedDurations(trace.duration, t.duration, formattedTrace.shortID(), info.shortID())})
                          </small>
                        </li>
                      );
                    })
                  : 'No similar traces found'}
              </ul>
            </GridItem>
          </Grid>
        </CardBody>
      </Card>
    );
  }
}

const comparedDurations = (
  d1: number | undefined,
  d2: number | undefined,
  d1Desc: string,
  d2Desc: string
): JSX.Element => {
  if (d2 === undefined || d1 === undefined) {
    return <>'n/a'</>;
  }
  const diff = d2 - d1;
  const absValue = formatDuration(Math.abs(diff));
  return (
    <Tooltip
      content={
        diff >= 0 ? (
          <>
            <strong>{d1Desc}</strong> is {absValue} <strong>faster</strong> than {d2Desc}
          </>
        ) : (
          <>
            <strong>{d1Desc}</strong> is {absValue} <strong>slower</strong> than {d2Desc}
          </>
        )
      }
    >
      {diff >= 0 ? (
        <span style={{ color: PFAlertColor.Success }}>-{absValue}</span>
      ) : (
        <span style={{ color: PFAlertColor.Danger }}>+{absValue}</span>
      )}
    </Tooltip>
  );
};

const mapStateToProps = (state: KialiAppState) => ({
  trace: state.jaegerState.selectedTrace
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  setTraceId: (traceId?: string) => dispatch(JaegerThunkActions.setTraceId(traceId))
});

const TraceDetailsContainer = connect(mapStateToProps, mapDispatchToProps)(TraceDetails);
export default TraceDetailsContainer;
