
"use client"

import * as React from "react"
import {
  Label,
  Pie,
  PieChart as RechartsPieChart,
  Sector,
  Tooltip as RechartsTooltip,
} from "recharts"
import {
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
  RadialBar,
  RadialBarChart as RechartsRadialBarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts"
import {
  Bar,
  CartesianGrid,
  Line,
  Area,
  BarChart as RechartsBarChart,
  LineChart as RechartsLineChart,
  AreaChart as RechartsAreaChart,
} from "recharts"
import { cn } from "@/lib/utils"
import {
  Card,
} from "@/components/ui/card"

// #region Chart

interface ChartConfig {
  [key: string]: {
    label?: string
    color?: string
  }
}

const ChartContext = React.createContext<{
  config: ChartConfig
  indicator: "dot" | "line" | "dashed"
  labelKey?: string
} | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    config: ChartConfig
    children: React.ComponentProps<typeof ResponsiveContainer>["children"]
    indicator?: "dot" | "line" | "dashed"
    labelKey?: string
  }
>(({ config, children, className, indicator = "dot", labelKey, ...props }, ref) => {
  return (
    <ChartContext.Provider value={{ config, indicator, labelKey }}>
      <div
        ref={ref}
        data-chart=""
        className={cn(
          "recharts-wrapper group/chart grid w-full gap-2 text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-defs_hatch-pattern_rect]:fill-muted-foreground [&_.recharts-polar-grid_[stroke=--color-border]]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-radial-grid_[stroke=--color-border]]:stroke-border [&_.recharts-reference-line_line]:stroke-border [&_.recharts-tooltip-cursor]:stroke-border",
          className
        )}
        {...props}
      >
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "Chart"

// #endregion

// #region Legend
const ChartLegendContext = React.createContext<{
  getLabel?: (value: string) => React.ReactNode
  hide?: boolean
} | null>(null)

type LegendProps = React.ComponentProps<typeof Legend> & {
  className?: string
  hide?: boolean
  getLabel?: (value: string) => React.ReactNode
}

const ChartLegend = ({
  className,
  hide,
  getLabel,
  ...props
}: LegendProps) => {
  return (
    <ChartLegendContext.Provider value={{ getLabel, hide }}>
      <Legend
        verticalAlign="bottom"
        height={36}
            content={
          hide 
            ? undefined 
            : (props: any) => (
                <ChartLegendContent
                  className={className}
                  payload={props.payload}
                  getLabel={getLabel}
                />
              )
        }
        {...props}
      />
    </ChartLegendContext.Provider>
  )
}
ChartLegend.displayName = "ChartLegend"

const ChartLegendContent = ({
  className,
  payload,
  getLabel,
  indicator = "dot",
}: React.ComponentProps<"div"> &
  Pick<React.ComponentProps<typeof Legend>, "payload"> & {
    getLabel?: (value: string) => React.ReactNode
    indicator?: "dot" | "line" | "dashed" | "rect"
  }) => {
  const { config, indicator: contextIndicator } = useChart()
  const finalIndicator = indicator || contextIndicator

  if (!payload?.length) {
    return null
  }

  return (
    <div
      className={cn(
        "flex w-full items-center justify-center gap-4 text-muted-foreground",
        className
      )}
    >
      {payload.map((item) => {
        const key = item.value as string
        const color =
          item.color ||
          (key in config ? `var(--color-${key})` : "var(--color-primary)")
        const label = getLabel?.(key) || key

        return (
          <div
            key={item.value}
            className="flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3"
          >
            {finalIndicator === "dot" ? (
              <div
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: color,
                }}
              />
            ) : finalIndicator === "rect" ? (
              <div
                className="h-2 w-2"
                style={{
                  backgroundColor: color,
                }}
              />
            ) : (
              <div
                className="h-px w-3"
                style={{
                  borderTop: `2px ${
                    finalIndicator === "dashed" ? "dashed" : "solid"
                  } ${color}`,
                }}
              />
            )}
            {label}
          </div>
        )
      })}
    </div>
  )
}
ChartLegendContent.displayName = "ChartLegendContent"
// #endregion

// #region Tooltip
const ChartTooltip = RechartsTooltip

const ChartTooltipContent = ({
  className,
  label: payloadLabel,
  payload,
  hideLabel,
  indicator = "dot",
  labelKey,
}: React.ComponentProps<"div"> &
  Pick<React.ComponentProps<typeof RechartsTooltip>, "payload"> & {
    label?: string
    hideLabel?: boolean
    indicator?: "dot" | "line" | "dashed" | "rect"
    labelKey?: string
  }) => {
  const {
    config,
    indicator: contextIndicator,
    labelKey: contextLabelKey,
  } = useChart()

  const finalIndicator = indicator || contextIndicator
  const finalLabelKey = labelKey || contextLabelKey

  if (!payload?.length) {
    return null
  }

  const firstPayload = payload[0]
  const { name: labelName } = firstPayload
  const label =
    payloadLabel ||
    (finalLabelKey && firstPayload.payload[finalLabelKey]) ||
    (typeof labelName === "number"
      ? labelName.toString()
      : labelName) ||
    ""

  return (
    <Card
      className={cn(
        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 grid min-w-32 gap-1.5 rounded-lg border bg-background/95 p-2.5 text-xs shadow-xl",
        className
      )}
    >
      {!hideLabel && label ? (
        <div className="font-medium text-muted-foreground">{label}</div>
      ) : null}
      <div className="grid gap-1.5">
        {payload.map((item, i) => {
          const key = `${item.name}`
          const color =
            item.color ||
            (key in config ? `var(--color-${key})` : "var(--color-primary)")
          const value =
            item.value && typeof item.value !== "object"
              ? item.value.toString()
              : ""
          const name = item.name || ""
          const series = config[key]

          return (
            <div
              key={item.dataKey || i}
              className="flex items-center gap-2 whitespace-nowrap"
            >
              {finalIndicator === "dot" ? (
                <div
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: color,
                  }}
                />
              ) : finalIndicator === "rect" ? (
                <div
                  className="h-2 w-2 shrink-0"
                  style={{
                    backgroundColor: color,
                  }}
                />
              ) : (
                <div
                  className="h-px w-3 shrink-0"
                  style={{
                    borderTop: `2px ${
                      finalIndicator === "dashed" ? "dashed" : "solid"
                    } ${color}`,
                  }}
                />
              )}
              <div className="flex flex-1 justify-between gap-4">
                <div className="text-muted-foreground">{series?.label || name}</div>
                <div className="font-medium">{value}</div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
ChartTooltipContent.displayName = "ChartTooltipContent"

// #endregion

// #region Bar Chart
const BarChart = RechartsBarChart
// #endregion

// #region Line Chart
const LineChart = RechartsLineChart
// #endregion

// #region Area Chart
const AreaChart = RechartsAreaChart
// #endregion

// #region Pie Chart
const PieChart = RechartsPieChart

const ChartPie = (props: React.ComponentProps<typeof Pie>) => {
  const { active, ...rest } = props
  const { config } = useChart()
  const [activeIndex, setActiveIndex] = React.useState<number | null>(
    active ? 0 : null
  )

  const chartConfig = React.useMemo(
    () =>
      Object.keys(config).map((key) => {
        return {
          key,
          ...config[key],
        }
      }),
    [config]
  )

  const onPieEnter = React.useCallback(
    (_: unknown, index: number) => {
      setActiveIndex(index)
    },
    [setActiveIndex]
  )
  const onPieLeave = React.useCallback(() => {
    setActiveIndex(null)
  }, [setActiveIndex])

  return (
    <Pie
      activeIndex={activeIndex ?? undefined}
      onMouseLeave={active ? onPieLeave : undefined}
      onMouseEnter={active ? onPieEnter : undefined} 
      dataKey="value"
      {...rest}
    >
      {props.data?.map((_, index) => (
        <Cell
          key={`cell-${index}`}
          fill={chartConfig[index % chartConfig.length]?.color}
          style={
            {
              "--color-primary": chartConfig[index % chartConfig.length]?.color,
            } as React.CSSProperties
          }
        />
      ))}
      {active && <Sector />}
      {rest.children}
    </Pie>
  )
}
ChartPie.displayName = "ChartPie"

const PieLabel = (
  props: React.ComponentProps<typeof Label> & {
    format?: (value: number) => string
  }
) => {
  return (
    <Label
      {...props}
      value={props.value ? props.format?.(props.value as number) : undefined}
    />
  )
}
// #endregion

// #region Radar Chart
const RadarChart = RechartsRadarChart

const ChartRadar = Radar
// #endregion

// #region Radial Chart
const RadialChart = RechartsRadialBarChart

const ChartRadial = RadialBar
// #endregion

// #region Exports
export {
  // Chart
  ChartContainer,
  // Legend
  ChartLegend,
  ChartLegendContent,
  // Tooltip
  ChartTooltip,
  ChartTooltipContent,
  // Bar Chart
  BarChart,
  // Line Chart
  LineChart,
  // Area Chart
  AreaChart,
  // Pie Chart
  PieChart,
  ChartPie,
  PieLabel,
  // Radar Chart
  RadarChart,
  ChartRadar,
  // Radial Chart
  RadialChart,
  ChartRadial,
  // Recharts
  ResponsiveContainer,
  RechartsTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Bar,
  Line,
  Area,
  Cell,
  Legend,
  Sector,
}

export type { ChartConfig }

  