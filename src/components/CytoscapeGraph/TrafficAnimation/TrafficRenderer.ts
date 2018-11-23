import { Point, clamp, quadraticBezier, linearInterpolation, distance, bezierLength } from '../../../utils/MathUtils';
import { DimClass } from '../graphs/GraphStyles';
import { EdgeConnectionType, TrafficEdgeType, TrafficPoint, TrafficPointType } from './Types';
import TrafficPointSkin from './Skins/TrafficPointSkin';

const TCP_SETTINGS = {
  baseSpeed: 0.5,
  timer: {
    max: 600,
    min: 150
  },
  sentRate: {
    min: 50,
    max: 1024 * 1024
  },
  errorRate: 0
};

// Min and max values to clamp the request per second rate
const TIMER_REQUEST_PER_SECOND_MIN = 0;
const TIMER_REQUEST_PER_SECOND_MAX = 750;

// Range of time to use between spawning a new dot.
// At higher request per second rate, faster dot spawning.
const TIMER_TIME_BETWEEN_DOTS_MIN = 20;
const TIMER_TIME_BETWEEN_DOTS_MAX = 1000;

// Clamp response time from min to max
const SPEED_RESPONSE_TIME_MIN = 0;
const SPEED_RESPONSE_TIME_MAX = 10;

// Speed to travel trough an edge
const SPEED_RATE_MIN = 0.1;
const SPEED_RATE_MAX = 2.0;

const BASE_LENGTH = 50;

// How often paint a frame
const FRAME_RATE = 1 / 60;

/**
 * Helps generate traffic points
 * timer - defines how fast to generate a new point, its in milliseconds.
 * timerForNextPoint - keeps track of how many milliseconds to generate the next point.
 * speed - defines the speed of the next point (see TrafficPoint.speed)
 */
class TrafficPointGenerator {
  private timer?: number;
  private timerForNextPoint?: number;
  private speed: number;
  private errorRate: number;
  private type: TrafficEdgeType;
  private pointSkin: TrafficPointSkin;

  constructor(pointSkin: TrafficPointSkin) {
    this.pointSkin = pointSkin;
  }

  /**
   * Process a render step for the generator, decrements the timerForNextPoint and
   * returns a new point if it reaches zero (or is close).
   * This method adds some randomness to avoid the "flat" look that all the points
   * are synchronized.
   */
  processStep(step: number, edge: any): TrafficPoint | undefined {
    if (this.timerForNextPoint !== undefined) {
      this.timerForNextPoint -= step;
      // Add some random-ness to make it less "flat"
      if (this.timerForNextPoint <= Math.random() * 200) {
        this.timerForNextPoint = this.timer;
        return this.nextPoint(edge);
      }
    }
    return undefined;
  }

  setTimer(timer: number | undefined) {
    this.timer = timer;
    // Start as soon as posible, unless we have no traffic
    if (this.timerForNextPoint === undefined) {
      this.timerForNextPoint = timer;
    }
  }

  setSpeed(speed: number) {
    this.speed = speed;
  }

  setErrorRate(errorRate: number) {
    this.errorRate = errorRate;
  }

  setType(type: TrafficEdgeType) {
    this.type = type;
  }

  setPointSkin(pointSkin: TrafficPointSkin) {
    this.pointSkin = pointSkin;
  }

  private nextPoint(edge: any): TrafficPoint {
    let offset;
    let trafficPointType: TrafficPointType;
    const isErrorPoint = Math.random() <= this.errorRate;
    if (this.type === TrafficEdgeType.HTTP) {
      trafficPointType = isErrorPoint ? TrafficPointType.HTTP_ERROR : TrafficPointType.HTTP_SUCCESS;
    } else {
      trafficPointType = TrafficPointType.TCP;
      // Cheap way to put some offset around the edge, I think this is enough unless we want more accuracy
      // More accuracy would need to identify the slope of current segment of the edgge (for curves and loops) to only do
      // offsets perpendicular to it, instead of it, we are moving around a circle area
      // Random offset (x,y); 'x' in [-1.5, 1.5] and 'y' in [-1.5, 1.5]
      offset = { x: Math.random() * 3 - 1.5, y: Math.random() * 3 - 1.5 };
    }

    return {
      speed: this.speed,
      delta: 0, // at the beginning of the edge
      renderer: this.pointSkin.forType(trafficPointType, edge),
      offset: offset,
      type: trafficPointType
    };
  }
}

/**
 * Holds the list of points an edge has.
 * points - list of active points the edge has, points are discarded when they
 *  reach their target.
 * generator - Generates the next point
 * edge - Edge where the traffic is tracked
 */
class TrafficEdge {
  private points: Array<TrafficPoint> = [];
  private generator: TrafficPointGenerator;
  private edge: any;
  private type: TrafficEdgeType;

  constructor(pointSkin: TrafficPointSkin) {
    this.generator = new TrafficPointGenerator(pointSkin);
  }

  /**
   * Process a step for the Traffic Edge, increments the delta of the points
   * Calls `processStep` for the generator and adds a new point if any.
   */
  processStep(step: number) {
    this.points = this.points.map(p => {
      p.delta += (step * p.speed) / 1000;
      return p;
    });
    const point = this.generator.processStep(step, this.edge);
    if (point) {
      this.points.push(point);
    }
  }

  getPoints() {
    return this.points;
  }

  getEdge() {
    return this.edge;
  }

  getType() {
    return this.type;
  }

  setTimer(timer: number | undefined) {
    this.generator.setTimer(timer);
  }

  /**
   * When a point is 1 or over it, is time to discard it.
   */
  removeFinishedPoints() {
    this.points = this.points.filter(p => p.delta <= 1);
  }

  setSpeed(speed: number) {
    this.generator.setSpeed(speed);
  }

  setErrorRate(errorRate: number) {
    this.generator.setErrorRate(errorRate);
  }

  setEdge(edge: any) {
    this.edge = edge;
  }

  setType(type: TrafficEdgeType) {
    this.type = type;
    this.generator.setType(type);
  }

  setPointSkin(pointSkin: TrafficPointSkin) {
    this.generator.setPointSkin(pointSkin);
    this.points = this.points.map(p => {
      p.renderer = pointSkin.forType(p.type, this.edge);
      return p;
    });
  }
}

type TrafficEdgeHash = {
  [edgeId: string]: TrafficEdge;
};

/**
 * Renders the traffic going from edges using the edge information to compute
 * their rate and speed
 *
 * rate determines how often to put a TrafficPoint in the edge.
 * responseTime determines how fast the TrafficPoint should travel from the start to the end of the edge.
 * percentErr determine if the next TrafficPoint is error or not.
 */
export default class TrafficRenderer {
  private animationTimer;
  private previousTimestamp;
  private trafficEdges: TrafficEdgeHash = {};
  private pointSkin: TrafficPointSkin;

  private readonly layer;
  private readonly canvas;
  private readonly context;

  constructor(cy: any, pointSkin: TrafficPointSkin, edges: any) {
    this.layer = cy.cyCanvas();
    this.canvas = this.layer.getCanvas();
    this.context = this.canvas.getContext('2d');
    this.pointSkin = pointSkin;
    this.setEdges(edges);
  }

  /**
   * Starts the rendering loop, discards any other rendering loop that was started
   */
  start() {
    this.stop();
    this.animationTimer = window.setInterval(this.processStep, FRAME_RATE * 1000);
  }

  /**
   * Stops the rendering loop if any
   */
  stop() {
    if (this.animationTimer) {
      window.clearInterval(this.animationTimer);
      this.animationTimer = undefined;
      this.clear();
    }
  }

  setEdges(edges: any) {
    this.trafficEdges = this.processEdges(edges);
  }

  setPointSkin(pointSkin: TrafficPointSkin) {
    this.pointSkin = pointSkin;
    Object.keys(this.trafficEdges).forEach(edgeId => {
      this.trafficEdges[edgeId].setPointSkin(pointSkin);
    });
  }

  clear() {
    this.layer.clear(this.context);
  }

  /**
   * Process a step, clears the canvas, sets the graph transformation to render
   * every dot.
   */
  processStep = () => {
    try {
      if (this.previousTimestamp === undefined) {
        this.previousTimestamp = Date.now();
      }
      const nextTimestamp = Date.now();
      const step = this.currentStep(nextTimestamp);
      this.layer.clear(this.context);
      this.layer.setTransform(this.context);
      Object.keys(this.trafficEdges).forEach(edgeId => {
        const trafficEdge = this.trafficEdges[edgeId];
        trafficEdge.processStep(step);
        trafficEdge.removeFinishedPoints();
        this.render(trafficEdge);
      });
      this.previousTimestamp = nextTimestamp;
    } catch (exception) {
      // If a step failed, the next step is likely to fail.
      // Stop the rendering and throw the exception
      this.stop();
      throw exception;
    }
  };

  /**
   * Renders the points inside the TrafficEdge (unless is dimmed)
   *
   */
  private render(trafficEdge: TrafficEdge) {
    const edge = trafficEdge.getEdge();
    if (edge.hasClass(DimClass)) {
      return;
    }
    trafficEdge.getPoints().forEach((point: TrafficPoint) => {
      const controlPoints = this.edgeControlPoints(edge);
      try {
        const pointInGraph = this.pointWithOffset(this.pointInGraph(controlPoints, point.delta), point.offset);

        if (pointInGraph) {
          point.renderer.render(this.context, pointInGraph);
        }
      } catch (error) {
        console.log(`Error rendering TrafficEdge, it won't be rendered: ${error.message}`);
      }
    });
  }

  private pointInGraph(controlPoints: Array<Point>, t: number) {
    /*
     * Control points are build so that if you have p0, p1, p2, p3, p4 points, you need to build 2 quadratic bezier:
     * 1) p0 (t=0), p1 (t=0.5) and p2 (t=1) and 2) p2 (t=0), p3 (t=0.5) and p4 (t=1)
     * p0 and p4 (or pn) are always the source and target of an edge.
     * Commonly there is only 2 points for straight lines, 3  points for curves and 5 points for loops.
     * Not going to generalize them now to avoid having a more complex code that is needed.
     * https://github.com/cytoscape/cytoscape.js/issues/2139#issuecomment-398473432
     */
    const edgeConnectionType = this.edgeConnectionTypeFromControlPoints(controlPoints);
    switch (edgeConnectionType) {
      case EdgeConnectionType.LINEAR:
        return linearInterpolation(controlPoints[0], controlPoints[1], t);
      case EdgeConnectionType.CURVE:
        return quadraticBezier(controlPoints[0], controlPoints[1], controlPoints[2], t);
      case EdgeConnectionType.LOOP:
        // Find the local t depending the current step
        if (t < 0.5) {
          // Normalize [0, 0.5)
          return quadraticBezier(controlPoints[0], controlPoints[1], controlPoints[2], t / 0.5);
        } else {
          // Normalize [0.5, 1]
          return quadraticBezier(controlPoints[2], controlPoints[3], controlPoints[4], (t - 0.5) * 2);
        }
      default:
        throw Error('Unhandled EdgeConnectionType:' + edgeConnectionType);
    }
  }

  private pointWithOffset(point: Point, offset: Point) {
    return offset === undefined ? point : { x: point.x + offset.x, y: point.y + offset.y };
  }

  private currentStep(currentTime: number): number {
    const step = currentTime - this.previousTimestamp;
    return step === 0 ? FRAME_RATE * 1000 : step;
  }

  private getTrafficEdgeType(edge: any) {
    if (edge.data('rate') !== undefined) {
      return TrafficEdgeType.HTTP;
    } else if (edge.data('tcpSentRate') !== undefined) {
      return TrafficEdgeType.TCP;
    }
    return TrafficEdgeType.NONE;
  }

  private processEdges(edges: any): TrafficEdgeHash {
    return edges.reduce((trafficEdges: TrafficEdgeHash, edge: any) => {
      const type = this.getTrafficEdgeType(edge);
      if (type !== TrafficEdgeType.NONE) {
        const edgeId = edge.data('id');
        if (edgeId in this.trafficEdges) {
          trafficEdges[edgeId] = this.trafficEdges[edgeId];
        } else {
          trafficEdges[edgeId] = new TrafficEdge(this.pointSkin);
        }
        trafficEdges[edgeId].setType(type);
        this.fillTrafficEdge(edge, trafficEdges[edgeId]);
      }
      return trafficEdges;
    }, {});
  }

  private fillTrafficEdge(edge: any, trafficEdge: TrafficEdge) {
    // Need to identify if we are going to fill a HTTP or TCP traffic edge
    // HTTP traffic has rate, responseTime, percentErr (among others) where TCP traffic only has: tcpSentRate

    let edgeLengthFactor = 1;
    try {
      const edgeLength = this.edgeLength(edge);
      edgeLengthFactor = BASE_LENGTH / Math.max(edgeLength, 1);
    } catch (error) {
      console.error(
        `Error when finding the length of the edge for the traffic animation, this TrafficEdge won't be rendered: ${
          error.message
        }`
      );
    }

    if (trafficEdge.getType() === TrafficEdgeType.HTTP) {
      const timer = this.timerFromRate(edge.data('rate'));
      // The edge of the length also affects the speed, include a factor in the speed to even visual speed for
      // long and short edges.
      const speed = this.speedFromResponseTime(edge.data('responseTime')) * edgeLengthFactor;
      const errorRate = edge.data('percentErr') === undefined ? 0 : edge.data('percentErr') / 100;
      trafficEdge.setSpeed(speed);
      trafficEdge.setTimer(timer);
      trafficEdge.setEdge(edge);
      trafficEdge.setErrorRate(errorRate);
    } else if (trafficEdge.getType() === TrafficEdgeType.TCP) {
      trafficEdge.setSpeed(TCP_SETTINGS.baseSpeed * edgeLengthFactor);
      trafficEdge.setErrorRate(TCP_SETTINGS.errorRate);
      trafficEdge.setTimer(this.timerFromTcpSentRate(edge.data('tcpSentRate'))); // 150 - 500
      trafficEdge.setEdge(edge);
    }
  }

  // for easing functions check https://gist.github.com/gre/1650294
  private timerFromRate(rate: number) {
    if (isNaN(rate) || rate === 0) {
      return undefined;
    }
    // Normalize requests per second within a range
    const delta =
      clamp(rate, TIMER_REQUEST_PER_SECOND_MIN, TIMER_REQUEST_PER_SECOND_MAX) / TIMER_REQUEST_PER_SECOND_MAX;

    // Invert and scale
    return (
      TIMER_TIME_BETWEEN_DOTS_MIN + Math.pow(1 - delta, 2) * (TIMER_TIME_BETWEEN_DOTS_MAX - TIMER_TIME_BETWEEN_DOTS_MIN)
    );
  }

  private timerFromTcpSentRate(tcpSentRate: number) {
    if (isNaN(tcpSentRate) || tcpSentRate === 0) {
      return undefined;
    }
    // Normalize requests per second within a range
    const delta = clamp(tcpSentRate, TCP_SETTINGS.sentRate.min, TCP_SETTINGS.sentRate.max) / TCP_SETTINGS.sentRate.max;

    // Invert and scale
    return TCP_SETTINGS.timer.min + Math.pow(1 - delta, 2) * (TCP_SETTINGS.timer.max - TCP_SETTINGS.timer.min);
  }

  private speedFromResponseTime(responseTime: number) {
    // Consider NaN response time as "everything is going as fast as possible"
    if (isNaN(responseTime)) {
      return SPEED_RATE_MAX;
    }
    // Normalize
    const delta = clamp(responseTime, SPEED_RESPONSE_TIME_MIN, SPEED_RESPONSE_TIME_MAX) / SPEED_RESPONSE_TIME_MAX;
    // Scale
    return SPEED_RATE_MIN + (1 - delta) * (SPEED_RATE_MAX - SPEED_RATE_MIN);
  }

  private edgeLength(edge: any) {
    const controlPoints = this.edgeControlPoints(edge);
    const edgeConnectionType = this.edgeConnectionTypeFromControlPoints(controlPoints);
    switch (edgeConnectionType) {
      case EdgeConnectionType.LINEAR:
        return distance(controlPoints[0], controlPoints[1]);
      case EdgeConnectionType.CURVE:
        return bezierLength(controlPoints[0], controlPoints[1], controlPoints[2]);
      case EdgeConnectionType.LOOP:
        return (
          bezierLength(controlPoints[0], controlPoints[1], controlPoints[2]) +
          bezierLength(controlPoints[2], controlPoints[3], controlPoints[4])
        );
      default:
        throw Error('Unhandled EdgeConnectionType:' + edgeConnectionType);
    }
  }

  private edgeControlPoints(edge: any) {
    const controlPoints: Array<Point> = [edge.sourceEndpoint()];
    const rawControlPoints = edge.controlPoints();
    if (rawControlPoints) {
      for (let i = 0; i < rawControlPoints.length; ++i) {
        controlPoints.push(rawControlPoints[i]);
        // If there is a next point, we are going to use the midpoint for the next point
        if (i + 1 < rawControlPoints.length) {
          controlPoints.push({
            x: (rawControlPoints[i].x + rawControlPoints[i + 1].x) / 2,
            y: (rawControlPoints[i].y + rawControlPoints[i + 1].y) / 2
          });
        }
      }
    }
    controlPoints.push(edge.targetEndpoint());
    return controlPoints;
  }

  private edgeConnectionTypeFromControlPoints(controlPoints: Array<Point>) {
    if (controlPoints.length === 2) {
      return EdgeConnectionType.LINEAR;
    } else if (controlPoints.length === 3) {
      return EdgeConnectionType.CURVE;
    } else if (controlPoints.length === 5) {
      return EdgeConnectionType.LOOP;
    } else {
      throw Error('Unknown EdgeConnectionType, ControlPoint.length=' + controlPoints.length);
    }
  }
}
