
import { ReactNode } from "react";

type RechartsFunction = (...args: unknown[]) => unknown;

declare module 'recharts' {
  type ContentType = ReactNode | ((props: Record<string, unknown>) => ReactNode);

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
    onClick?: RechartsFunction;
    onMouseEnter?: RechartsFunction;
    onMouseLeave?: RechartsFunction;
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
    activeShape?: unknown | React.ReactElement | ((props: Record<string, unknown>) => ReactNode);
    label?: boolean | unknown | React.ReactElement | ((props: Record<string, unknown>) => ReactNode);
    labelLine?: boolean | unknown | React.ReactElement | ((props: Record<string, unknown>) => ReactNode);
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
    wrapperStyle?: Record<string, unknown>;
    cursor?: boolean | Record<string, unknown> | React.ReactElement;
    viewBox?: { x?: number; y?: number; width?: number; height?: number };
    active?: boolean;
    coordinate?: { x: number; y: number };
    payload?: unknown[];
    label?: string | number;
  }

  class ResponsiveContainer extends React.Component<Record<string, unknown>> {}
  class XAxis extends React.Component<Record<string, unknown>> {}
  class YAxis extends React.Component<Record<string, unknown>> {}
  class CartesianGrid extends React.Component<Record<string, unknown>> {}
  class Tooltip extends React.Component<TooltipProps> {}
  class Legend extends React.Component<LegendProps> {}
  class Cell extends React.Component<Record<string, unknown>> {}
  class Sector extends React.Component<Record<string, unknown>> {}
  class Pie extends React.Component<PieProps> {}
  class Bar extends React.Component<Record<string, unknown>> {}
  class Line extends React.Component<Record<string, unknown>> {}
  class Area extends React.Component<Record<string, unknown>> {}
  class Label extends React.Component<Record<string, unknown>> {}
  class LabelList extends React.Component<Record<string, unknown>> {}
  class PolarGrid extends React.Component<Record<string, unknown>> {}
  class PolarAngleAxis extends React.Component<Record<string, unknown>> {}
  class PolarRadiusAxis extends React.Component<Record<string, unknown>> {}
  class Radar extends React.Component<Record<string, unknown>> {}
  class RadialBar extends React.Component<Record<string, unknown>> {}

  class BarChart extends React.Component<Record<string, unknown>> {}
  class LineChart extends React.Component<Record<string, unknown>> {}
  class AreaChart extends React.Component<Record<string, unknown>> {}
  class PieChart extends React.Component<Record<string, unknown>> {}
  class RadarChart extends React.Component<Record<string, unknown>> {}
  class RadialBarChart extends React.Component<Record<string, unknown>> {}
}
