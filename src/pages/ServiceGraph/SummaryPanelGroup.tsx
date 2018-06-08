import * as React from 'react';
import Badge from '../../components/Badge/Badge';
import InOutRateTable from '../../components/SummaryPanel/InOutRateTable';
import RpsChart from '../../components/SummaryPanel/RpsChart';
import { SummaryPanelPropType } from '../../types/Graph';
import * as API from '../../services/Api';
import * as M from '../../types/Metrics';
import graphUtils from '../../utils/Graphing';
import { getAccumulatedTrafficRate } from '../../utils/TrafficRate';
import MetricsOptions from '../../types/MetricsOptions';
import { PfColors } from '../../components/Pf/PfColors';
import { Icon } from 'patternfly-react';
import { authentication } from '../../utils/Authentication';
import { Link } from 'react-router-dom';
import { shouldRefreshData } from './SummaryPanelCommon';
import { HealthIndicator, DisplayMode } from '../../components/ServiceHealth/HealthIndicator';

type SummaryPanelGroupState = {
  loading: boolean;
  requestCountIn: [string, number][];
  requestCountOut: [string, number][];
  errorCountIn: [string, number][];
  errorCountOut: [string, number][];
};

export default class SummaryPanelGroup extends React.Component<SummaryPanelPropType, SummaryPanelGroupState> {
  static readonly panelStyle = {
    position: 'absolute' as 'absolute',
    width: '25em',
    top: 0,
    right: 0,
    bottom: 0,
    overflowY: 'auto' as 'auto'
  };

  // avoid state changes after component is unmounted
  _isMounted: boolean = false;

  constructor(props: SummaryPanelPropType) {
    super(props);
    this.state = {
      loading: true,
      requestCountIn: [],
      requestCountOut: [],
      errorCountIn: [],
      errorCountOut: []
    };
  }

  componentDidMount() {
    this._isMounted = true;
    this.updateRpsCharts(this.props);
  }

  componentDidUpdate(prevProps: SummaryPanelPropType) {
    if (shouldRefreshData(prevProps, this.props)) {
      this.updateRpsCharts(this.props);
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  render() {
    const group = this.props.data.summaryTarget;

    const namespace = group.data('service').split('.')[1];
    const service = group.data('service').split('.')[0];
    const serviceHotLink = <Link to={`/namespaces/${namespace}/services/${service}`}>{service}</Link>;
    const health = group.data('health');

    const incoming = getAccumulatedTrafficRate(group.children());
    const outgoing = getAccumulatedTrafficRate(group.children().edgesTo('*'));

    return (
      <div className="panel panel-default" style={SummaryPanelGroup.panelStyle}>
        <div className="panel-heading">
          {health && (
            <HealthIndicator
              id="graph-health-indicator"
              mode={DisplayMode.SMALL}
              health={health}
              tooltipPlacement="left"
              rateInterval="10m"
            />
          )}
          <span> Versioned Group: {serviceHotLink}</span>
          <div style={{ paddingTop: '3px' }}>
            <Badge
              scale={0.9}
              style="plastic"
              leftText="namespace"
              rightText={namespace}
              key={namespace}
              color={PfColors.Green400}
            />
            {this.renderVersionBadges()}
          </div>
          {this.renderBadgeSummary(group.data('hasRR'))}
        </div>
        <div className="panel-body">
          <p style={{ textAlign: 'right' }}>
            <Link
              to={`/namespaces/${namespace}/services/${service}?tab=metrics&groupings=local+version%2Cresponse+code`}
            >
              View detailed charts <Icon name="angle-double-right" />
            </Link>
          </p>
          <InOutRateTable
            title="Request Traffic (requests per second):"
            inRate={incoming.rate}
            inRate3xx={incoming.rate3xx}
            inRate4xx={incoming.rate4xx}
            inRate5xx={incoming.rate5xx}
            outRate={outgoing.rate}
            outRate3xx={outgoing.rate3xx}
            outRate4xx={outgoing.rate4xx}
            outRate5xx={outgoing.rate5xx}
          />
          <hr />
          <div>{this.renderRpsCharts()}</div>
        </div>
      </div>
    );
  }

  private updateRpsCharts = (props: SummaryPanelPropType) => {
    const namespace = props.data.summaryTarget.data('service').split('.')[1];
    const service = props.data.summaryTarget.data('service').split('.')[0];
    const options: MetricsOptions = {
      queryTime: props.queryTime,
      duration: +props.duration,
      step: props.step,
      rateInterval: props.rateInterval,
      filters: ['request_count', 'request_error_count']
    };
    API.getServiceMetrics(authentication(), namespace, service, options)
      .then(response => {
        if (!this._isMounted) {
          console.log('SummaryPanelGroup: Ignore fetch, component not mounted.');
          return;
        }
        const metrics = response.data.metrics;
        const reqCountIn: M.MetricGroup = metrics['request_count_in'];
        const reqCountOut: M.MetricGroup = metrics['request_count_out'];
        const errCountIn: M.MetricGroup = metrics['request_error_count_in'];
        const errCountOut: M.MetricGroup = metrics['request_error_count_out'];

        this.setState({
          loading: false,
          requestCountIn: graphUtils.toC3Columns(reqCountIn.matrix, 'RPS'),
          requestCountOut: graphUtils.toC3Columns(reqCountOut.matrix, 'RPS'),
          errorCountIn: graphUtils.toC3Columns(errCountIn.matrix, 'Error'),
          errorCountOut: graphUtils.toC3Columns(errCountOut.matrix, 'Error')
        });
      })
      .catch(error => {
        if (!this._isMounted) {
          console.log('SummaryPanelGroup: Ignore fetch error, component not mounted.');
          return;
        }
        // TODO: show error alert
        this.setState({ loading: false });
        console.error(error);
      });
  };

  private renderVersionBadges = () => {
    return this.props.data.summaryTarget
      .children()
      .toArray()
      .map((c, i) => (
        <Badge
          scale={0.9}
          style="plastic"
          leftText="version"
          rightText={c.data('version')}
          key={c.data('version')}
          color={PfColors.Green400}
        />
      ));
  };

  private renderBadgeSummary = (hasRR: string) => {
    const displayRR = hasRR === 'true';
    return (
      <>
        {displayRR && (
          <div>
            <Icon name="code-fork" type="fa" style={{ width: '10px' }} />
            Has Route Rule
          </div>
        )}
      </>
    );
  };

  private renderRpsCharts = () => {
    if (this.state.loading) {
      return <strong>loading charts...</strong>;
    }
    return (
      <>
        <RpsChart
          label="Incoming Request Traffic"
          dataRps={this.state.requestCountIn}
          dataErrors={this.state.errorCountIn}
        />
        <RpsChart
          label="Outgoing Request Traffic"
          dataRps={this.state.requestCountOut}
          dataErrors={this.state.errorCountOut}
        />
      </>
    );
  };
}
