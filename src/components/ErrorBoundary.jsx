import { Component } from 'react'
import { getStoredTheme } from '../lib/theme'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      const isDark = getStoredTheme() === 'dark'
      return (
        <div
          className={`theme-shell ${isDark ? 'dark-theme' : ''} min-h-screen flex items-center justify-center p-8 text-center`}
        >
          <div className="theme-panel-strong rounded-3xl p-8 shadow-2xl max-w-md w-full">
            <p className="text-5xl mb-4">🌸</p>
            <h1 className="text-2xl font-bold theme-heading mb-2">Oops! Something went wrong</h1>
            <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
              {this.state.error.message ?? 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="bg-pink-400 hover:bg-pink-500 text-white font-semibold
                         px-6 py-2.5 rounded-full transition-colors shadow-md"
            >
              Try Again ✨
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
