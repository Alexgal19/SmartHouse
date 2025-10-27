
import { ReactNode } from "react";

declare module 'recharts' {
  type ContentType = ReactNode | ((props: any) => ReactNode);

  interface LegendPayloadItem {
    value: string;
    id?: string;
    type?: string;
    color?: string;
    strokeDasharray?: string;
    inactive?: boolean;
    dataKey?: string;
    name?: string;
    payload?: unknown;
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
    data?: unknown[];
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
    activeShape?: unknown | React.ReactElement | ((props: unknown) => ReactNode);
    label?: boolean | unknown | React.ReactElement | ((props: unknown) => ReactNode);
    labelLine?: boolean | unknown | React.ReactElement | ((props: unknown) => ReactNode);
    onClick?: (data: unknown, index: number) => void;
    onMouseEnter?: (data: unknown, index: number) => void;
    onMouseLeave?: (data: unknown, index: number) => void;
    activeRadius?: number;
    children?: ReactNode;
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
    payload?: unknown[];
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

    