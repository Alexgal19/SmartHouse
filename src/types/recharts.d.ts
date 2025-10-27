
declare module 'recharts' {
  type ContentType = React.ReactNode | ((props: any) => React.ReactNode);

  interface LegendPayloadItem {
    value: string;
    id?: string;
    type?: string;
    color?: string;
    strokeDasharray?: string;
    inactive?: boolean;
    dataKey?: string;
    name?: string;
    payload?: any;
  }

  interface LegendProps {
    content?: ContentType;
    iconSize?: number;
    iconType?: string;
    layout?: string;
    verticalAlign?: string;
    align?: string;
    wrapperStyle?: React.CSSProperties;
    chartWidth?: number;
    chartHeight?: number;
    width?: number;
    height?: number;
    margin?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
    payload?: LegendPayloadItem[];
    onClick?: (item: LegendPayloadItem) => void;
    onMouseEnter?: (item: LegendPayloadItem) => void;
    onMouseLeave?: (item: LegendPayloadItem) => void;
  }

  interface PieProps {
    data?: Array<any>;
    nameKey?: string;
    dataKey?: string;
    value?: string | number;
    innerRadius?: number;
    outerRadius?: number;
    cornerRadius?: number;
    startAngle?: number;
    endAngle?: number;
    paddingAngle?: number;
    cx?: string | number;
    cy?: string | number;
    activeIndex?: number;
    activeShape?: any;
    label?: boolean | any | React.ReactElement | ((props: any) => React.ReactNode);
    labelLine?: boolean | any | React.ReactElement | ((props: any) => React.ReactNode);
    onClick?: (data: any, index: number) => void;
    onMouseEnter?: (data: any, index: number) => void;
    onMouseLeave?: (data: any, index: number) => void;
    activeRadius?: number;
    children?: React.ReactNode;
    strokeWidth?: number;
    active?: boolean;
  }

  interface TooltipProps {
    content?: ContentType;
    separator?: string;
    offset?: number;
    wrapperStyle?: object;
    cursor?: boolean | object | React.ReactElement;
    viewBox?: { x?: number; y?: number; width?: number; height?: number };
    active?: boolean;
    coordinate?: { x: number; y: number };
    payload?: Array<any>;
    label?: string | number;
  }

  class ResponsiveContainer extends React.Component<any> {}
  class XAxis extends React.Component<any> {}
  class YAxis extends React.Component<any> {}
  class CartesianGrid extends React.Component<any> {}
  class Tooltip extends React.Component<TooltipProps> {}
  class Legend extends React.Component<LegendProps> {}
  class Cell extends React.Component<any> {}
  class Sector extends React.Component<any> {}
  class Pie extends React.Component<PieProps> {}
  class Bar extends React.Component<any> {}
  class Line extends React.Component<any> {}
  class Area extends React.Component<any> {}
  class Label extends React.Component<any> {}
  class LabelList extends React.Component<any> {}
  class PolarGrid extends React.Component<any> {}
  class PolarAngleAxis extends React.Component<any> {}
  class PolarRadiusAxis extends React.Component<any> {}
  class Radar extends React.Component<any> {}
  class RadialBar extends React.Component<any> {}

  class BarChart extends React.Component<any> {}
  class LineChart extends React.Component<any> {}
  class AreaChart extends React.Component<any> {}
  class PieChart extends React.Component<any> {}
  class RadarChart extends React.Component<any> {}
  class RadialBarChart extends React.Component<any> {}
}

  