import * as shape from 'd3-shape';

//Line Charts

export var lineChartView: any[] = [550, 400];

// options
export var lineChartShowXAxis = true;
export var lineChartShowYAxis = true;
export var lineChartGradient = false;
export var lineChartShowLegend = false;
export var lineChartShowXAxisLabel = true;
export var lineChartShowYAxisLabel = true;

export var lineChartColorScheme = {
    domain: ['#FF8D60', '#FF586B', '#14dd16', '#01579b', '#ffce44','#6e5818', '#14dd16', '#000000']
};
export var lineChartOneColorScheme = {
    domain: ['#009DA0']
};

export var lineChartOneColorScheme2 = {
    domain: ['#009DA0']
};

// line, area
export var lineChartAutoScale = true;
export var lineChartLineInterpolation = shape.curveBasis;

//Bar Chart

export var barChartView: any[] = [300, 200];

// options
export var barChartShowXAxis = true;
export var barChartShowYAxis = true;
export var barChartGradient = false;
export var barChartShowLegend = false;
export var barChartShowXAxisLabel = true;
export var barChartXAxisLabel = 'Country';
export var barChartShowYAxisLabel = true;
export var barChartYAxisLabel = 'Population';

export var barChartColorScheme = {
    domain: ['#009DA0', '#FF8D60', '#FF586B', '#AAAAAA']
};
