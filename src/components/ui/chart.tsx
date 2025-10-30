
"use client"

import * as React from "react"
import * as Recharts from "recharts"


import { cn } from "@/lib/utils"
import {
  Card
} from "@/components/ui/card"

export const BarChart = Recharts.BarChart;
export const LineChart = Recharts.LineChart;
export const AreaChart = Recharts.AreaChart;
export const PieChart = Recharts.PieChart;
export const RadarChart = Recharts.RadarChart;
export const RadialBarChart = Recharts.RadialBarChart;
export const ResponsiveContainer = Recharts.ResponsiveContainer;
export const XAxis = Recharts.XAxis;
export const YAxis = Recharts.YAxis;
export const CartesianGrid = Recharts.CartesianGrid;
export const Bar = Recharts.Bar;
export const Line = Recharts.Line;
export const Area = Recharts.Area;
export const Cell = Recharts.Cell;
export const Legend = Recharts.Legend;
export const Sector = Recharts.Sector;
export const Label = Recharts.Label;
export const LabelList = Recharts.LabelList;
export const Pie = Recharts.Pie;
export const Radar = Recharts.Radar;
export const RadialBar = Recharts.RadialBar;
export { Tooltip as RechartsTooltip } from "recharts";

// #region Chart

interface ChartConfig {
  [key: string]: {
    label?: React.ReactNode;
    color?: string
    icon?: React.ComponentType;
  }
}

const ChartContext = React.createContext<{
  config: ChartConfig;
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
  }
>(({ config, children, className, ...props }, ref) => {
  const chartConfig = React.useMemo(
    () =>
      Object.entries(config).reduce(
        (prev, [key, value]) => ({
          ...prev,
          [key]: {
            ...value,
            color: value.color ?? `hsl(var(--chart-${Object.keys(prev).length + 1}))`,
          },
        }),
        {}
      ),
    [config]
  )

  return (
    <ChartContext.Provider value={{ config: chartConfig }}>
      <div
        ref={ref}
        data-chart=""
        className={cn(
          "recharts-wrapper group/chart grid w-full items-start gap-2 text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-defs_hatch-pattern_rect]:fill-muted-foreground [&_.recharts-polar-grid_[stroke=--color-border]]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-radial-grid_[stroke=--color-border]]:stroke-border [&_.recharts-reference-line_line]:stroke-border [&_.recharts-tooltip-cursor]:stroke-border",
          className
        )}
        style={
          Object.entries(chartConfig).reduce(
            (prev, [key, value]) => {
                if (typeof value === 'object' && value !== null && 'color' in value && typeof value.color === 'string') {
                    return {
                        ...prev,
                        [`--color-${key}`]: value.color,
                    };
                }
                return prev;
            },
            {}
        ) as React.CSSProperties
        }
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
const ChartLegend = Recharts.Legend


const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    Pick<React.ComponentProps<typeof Legend>, "payload"> & {
      hideIcon?: boolean
      nameKey?: string
    }
>(
  (
    { className, hideIcon = false, payload = [], nameKey = "value", ...props },
    ref
  ) => {
    const { config } = useChart()

    return (
      <div
        ref={ref}
        className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}
        {...props}
      >
        {payload.map((item) => {
          const key = String(item[nameKey as keyof typeof item]);
          const itemConfig = config[key]

          return (
            <div
              key={item.value}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap [&>svg]:h-3 [&>svg]:w-3"
              )}
            >
              {!hideIcon && itemConfig?.icon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label}
            </div>
          )
        })}
      </div>
    )
  }
)
ChartLegendContent.displayName = "ChartLegendContent"
// #endregion

// #region Tooltip

type TooltipContentProps = React.ComponentProps<typeof Recharts.Tooltip> &
  React.ComponentProps<"div"> & {
    hideLabel?: boolean
    hideIndicator?: boolean
    indicator?: "line" | "dot" | "dashed"
    nameKey?: string
    labelKey?: string
    formatter?: (value: number, name: string, item: any, index: number) => React.ReactNode,
    labelFormatter?: (label: any, payload: any[]) => React.ReactNode,
    labelClassName?: string,
  }

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  TooltipContentProps
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      formatter,
      labelClassName,
      wrapperStyle,
      nameKey = "dataKey",
      labelKey = "payload",
    },
    ref
  ) => {
    const { config } = useChart()

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload || payload.length === 0) {
        return null
      }

      if (label) {
        return label
      }

      if (labelFormatter) {
        const payloadValue = payload[0];
        if (payloadValue && typeof payloadValue === 'object' && 'value' in payloadValue) {
            return labelFormatter(payloadValue.value, payload);
        }
      }

      if (!payload[0].payload) {
        return null
      }

      const itemPayload = payload[0].payload
      const value = itemPayload[labelKey]

      if (typeof value === "string") {
        return value
      }

      if (
        typeof value === "number" &&
        payload[0].value && typeof payload[0].value === "number" &&
        isFinite(payload[0].value)
      ) {
        return new Date(value).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      }

      return null
    }, [label, labelFormatter, payload, hideLabel, labelKey])

    if (!active || !payload || payload.length === 0) {
      return null
    }

    return (
      <Card
        ref={ref}
        className={cn(
          "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 grid min-w-32 gap-1.5 rounded-lg border bg-background/95 p-2.5 text-xs shadow-xl",
          className
        )}
        style={wrapperStyle}
      >
        {!hideLabel && tooltipLabel ? (
          <div className={cn("font-medium", labelClassName)}>{tooltipLabel}</div>
        ) : null}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = String(item[nameKey as keyof typeof item]);
            const itemConfig = config[key]
            const indicatorColor = item.color || itemConfig?.color

            return (
              <div
                key={item.dataKey}
                className={cn(
                  "flex w-full items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground"
                )}
              >
                {!hideIndicator && (
                  <div
                    className={cn(
                      "shrink-0",
                      indicator === "dot" && "flex items-center",
                      indicator === "line" && "flex items-center",
                      indicator === "dashed" && "my-0.5"
                    )}
                  >
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : indicator === "dot" ? (
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{
                          background: indicatorColor,
                        }}
                      />
                    ) : (
                      <div
                        className={cn(
                          "w-3 h-px",
                          indicator === "dashed" && "border-dashed"
                        )}
                        style={{
                          background: "transparent",
                          borderColor: indicatorColor,
                          borderTopWidth: 2,
                        }}
                      />
                    )}
                  </div>
                )}
                <div
                  className={cn(
                    "flex flex-1 justify-between whitespace-nowrap"
                  )}
                >
                  <div className={cn("text-muted-foreground")}>
                    {itemConfig?.label || item.name}
                  </div>
                  <div className={cn("font-medium")}>
                    {formatter && typeof item.value === 'number'
                      ? formatter(item.value, item.name as string, item, index)
                      : `${item.value}`}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltipContent"

// #endregion

// #region Pie Chart
const ChartPie = (
  props: React.ComponentProps<typeof Pie> & {
    active?: boolean
  }
) => {
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

  const onPieEnter = React. useCallback(
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

// #region Exports
export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltipContent,
  ChartPie,
  PieLabel,
}

export type { ChartConfig }

