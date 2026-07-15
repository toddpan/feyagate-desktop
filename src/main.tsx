import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { HashRouter } from 'react-router-dom'
import { ConfigProvider, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          colorInfo: '#1677ff',
          colorSuccess: '#16a34a',
          colorWarning: '#d97706',
          colorError: '#dc2626',
          colorLink: '#1677ff',
          colorBgLayout: '#f6f8fb',
          colorBgContainer: '#ffffff',
          colorText: '#1f2329',
          colorTextSecondary: '#5b6473',
          colorBorder: '#eef0f4',
          colorBorderSecondary: '#eef0f4',
          borderRadius: 10,
          borderRadiusLG: 14,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Roboto, sans-serif",
          fontSize: 14,
          controlHeight: 36,
          controlHeightLG: 40,
          wireframe: false,
        },
        components: {
          Layout: {
            bodyBg: '#f6f8fb',
            siderBg: '#ffffff',
            headerBg: '#ffffff',
            triggerBg: 'transparent',
          },
          Card: {
            borderRadiusLG: 14,
            paddingLG: 20,
            headerBg: 'transparent',
            headerFontSize: 15,
          },
          Table: {
            headerBg: '#fafbfc',
            headerColor: '#5b6473',
            headerSplitColor: 'transparent',
            borderColor: '#eef0f4',
            rowHoverBg: '#f0f7ff',
          },
          Button: {
            borderRadius: 8,
            controlHeight: 36,
            controlHeightLG: 40,
            fontWeight: 500,
          },
          Tag: {
            borderRadiusSM: 6,
            defaultBg: '#fafbfc',
            defaultColor: '#5b6473',
          },
          Menu: {
            itemBg: 'transparent',
            itemSelectedBg: '#e6f4ff',
            itemSelectedColor: '#1677ff',
            itemHoverBg: '#f5f8fc',
            itemActiveBg: '#e6f4ff',
            itemBorderRadius: 8,
            itemMarginInline: 8,
            itemMarginBlock: 2,
            iconSize: 15,
            collapsedIconSize: 18,
          },
          Modal: {
            borderRadiusLG: 14,
          },
          Tabs: {
            itemSelectedColor: '#1677ff',
            inkBarColor: '#1677ff',
            horizontalMargin: '0 0 16px 0',
          },
          Statistic: {
            titleFontSize: 13,
            contentFontSize: 22,
          },
          Input: {
            borderRadius: 8,
            controlHeight: 36,
          },
          Select: {
            borderRadius: 8,
            controlHeight: 36,
          },
          Drawer: {
            borderRadiusLG: 14,
          },
          Tooltip: {
            borderRadius: 6,
          },
        },
      }}
    >
      <HashRouter>
        <App />
      </HashRouter>
    </ConfigProvider>
  </React.StrictMode>,
)
