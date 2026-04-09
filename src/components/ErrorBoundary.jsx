import { Component } from 'react'

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
      return (
        <div
          className="min-h-screen flex items-center justify-center p-8 text-center"
          style={{ background: 'linear-gradient(135deg, #FFD1DC 0%, #FFF0F5 50%, #B2E2F2 100%)' }}
        >
          <div>
            <p className="text-5xl mb-4">🌸</p>
            <h1 className="text-2xl font-bold text-pink-500 mb-2">Oops! Something went wrong</h1>
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
