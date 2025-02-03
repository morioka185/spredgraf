import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

const SPREADSHEET_ID = '1kpyTPIGCLtkDHS_964d9LWrrqlLV9vqpT9DfEU442CA';
const SHEET_GID = '1695733723';

const SpreadsheetChartViewer = () => {
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('');
  const [chartType, setChartType] = useState('line');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSpreadsheetData();
  }, []);

  const loadSpreadsheetData = async () => {
    try {
      setLoading(true);
      setError('');

      const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
      const response = await fetch(csvUrl);

      if (!response.ok) {
        throw new Error(`スプレッドシートの取得に失敗しました (Status: ${response.status})`);
      }

      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: false,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            // ヘッダー行（3行目, index: 2）を取得
            const headerRow = results.data[2];
            // データは5行目(index: 4)から
            const dataRows = results.data.slice(4);
            
            // ヘッダーの処理（D列からBG列まで）
            const processedHeaders = headerRow.slice(3, 59).map(header => 
              header ? header.toString().trim() : ''
            ).filter(Boolean);
            
            // データの処理
            const processedData = dataRows.map(row => {
              if (!row || row.length < 4) return null;

              const dataPoint = {
                date: row[1] // B列を日付として使用
              };
              
              processedHeaders.forEach((header, index) => {
                let value = row[index + 3]; // D列から開始
                // 数値の正規化
                if (typeof value === 'string') {
                  // カンマと通貨記号を削除
                  value = value.replace(/[¥,]/g, '');
                  // パーセント値の処理
                  if (value.includes('%')) {
                    value = parseFloat(value.replace('%', ''));
                  } else {
                    value = parseFloat(value);
                  }
                }
                dataPoint[header] = isNaN(value) ? null : value;
              });
              
              return dataPoint;
            }).filter(row => row && row.date); // nullと日付がないデータを除外

            setHeaders(processedHeaders);
            setData(processedData);
            if (processedHeaders.length > 0) {
              setSelectedMetric(processedHeaders[0]);
            }
          } catch (err) {
            setError('データの処理中にエラーが発生しました: ' + err.message);
          }
        },
        error: (err) => {
          setError('スプレッドシートの解析中にエラーが発生しました: ' + err.message);
        }
      });
    } catch (err) {
      setError('エラーが発生しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderChart = () => {
    if (!data.length || !selectedMetric) return null;

    const ChartComponent = chartType === 'line' ? LineChart : BarChart;
    const DataComponent = chartType === 'line' ? Line : Bar;
    const isPercentage = selectedMetric.includes('%');

    // 今日の日付を取得
    const today = new Date();
    today.setHours(0, 0, 0, 0);  // 時刻部分をリセット

    // 今日までのデータのみをフィルタリングして平均値を計算
    const values = data
      .filter(item => {
        const itemDate = new Date(item.date);
        return itemDate <= today;
      })
      .map(item => item[selectedMetric])
      .filter(value => value != null);
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;

    // カスタムツールチップの内容
    const CustomTooltip = ({ active, payload, label }) => {
      if (!active || !payload || !payload.length) return null;

      const currentValue = payload[0].value;
      const deviation = currentValue - average;
      const deviationPercent = (deviation / average) * 100;

      return (
        <div style={{
          backgroundColor: 'white',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}>
          <p style={{ margin: '0 0 5px' }}><strong>日付:</strong> {label}</p>
          <p style={{ margin: '0 0 5px' }}>
            <strong>{selectedMetric}:</strong> {
              isPercentage ? `${currentValue.toFixed(2)}%` : currentValue.toLocaleString()
            }
          </p>
          <p style={{ margin: '0 0 5px' }}>
            <strong>平均値:</strong> {
              isPercentage ? `${average.toFixed(2)}%` : average.toLocaleString()
            }
          </p>
          <p style={{ margin: '0', color: deviation >= 0 ? '#4caf50' : '#f44336' }}>
            <strong>平均との乖離:</strong> {
              isPercentage 
                ? `${deviation.toFixed(2)}%`
                : deviation.toLocaleString()
            }
            {' '}
            ({deviationPercent.toFixed(2)}%)
          </p>
        </div>
      );
    };

    return (
      <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
          <ChartComponent data={data} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
            />
            <YAxis
              domain={isPercentage ? [0, 100] : ['auto', 'auto']}
              tickFormatter={value => isPercentage ? `${value}%` : value.toLocaleString()}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <ReferenceLine
              y={average}
              stroke="#ff7300"
              strokeDasharray="3 3"
              label={{
                position: 'right',
                value: `平均: ${isPercentage ? average.toFixed(2) + '%' : average.toLocaleString()}`,
                fill: '#ff7300',
                fontSize: 12
              }}
            />
            <DataComponent
              type="monotone"
              dataKey={selectedMetric}
              stroke="#8884d8"
              fill="#8884d8"
              name={selectedMetric}
            />
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    );
  };

  const containerStyle = {
    padding: '20px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  };

  return (
    <div style={containerStyle}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0 }}>データ可視化</h2>
        <button 
          onClick={loadSpreadsheetData}
          disabled={loading}
          style={{
            padding: '8px 16px',
            backgroundColor: '#f0f0f0',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'データ取得中...' : 'データを更新'}
        </button>
      </div>

      {error && (
        <div style={{ 
          color: '#dc2626',
          padding: '12px',
          marginBottom: '20px',
          backgroundColor: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      {data.length > 0 && (
        <div>
          <div style={{ 
            display: 'flex',
            gap: '20px',
            marginBottom: '20px',
            alignItems: 'center'
          }}>
            <div>
              <label style={{ marginRight: '10px' }}>グラフタイプ:</label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                style={{ 
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              >
                <option value="line">折れ線グラフ</option>
                <option value="bar">棒グラフ</option>
              </select>
            </div>

            <div>
              <label style={{ marginRight: '10px' }}>表示するデータ:</label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                style={{ 
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  minWidth: '200px'
                }}
              >
                {headers.map(header => (
                  <option key={header} value={header}>{header}</option>
                ))}
              </select>
            </div>
          </div>

          {renderChart()}

          <div style={{ 
            marginTop: '20px',
            overflowX: 'auto'
          }}>
            <table style={{ 
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #ddd'
            }}>
              <thead>
                <tr>
                  <th style={{ 
                    padding: '10px',
                    border: '1px solid #ddd',
                    backgroundColor: '#f5f5f5'
                  }}>日付</th>
                  {headers.map(header => (
                    <th key={header} style={{ 
                      padding: '10px',
                      border: '1px solid #ddd',
                      backgroundColor: '#f5f5f5'
                    }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr key={index}>
                    <td style={{ 
                      padding: '10px',
                      border: '1px solid #ddd'
                    }}>{row.date}</td>
                    {headers.map(header => (
                      <td key={header} style={{ 
                        padding: '10px',
                        border: '1px solid #ddd',
                        textAlign: 'right'
                      }}>
                        {row[header] != null ? 
                          (header.includes('%') ? 
                            `${row[header].toFixed(2)}%` : 
                            row[header].toLocaleString()
                          ) : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpreadsheetChartViewer;