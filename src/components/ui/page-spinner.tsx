export function PageSpinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className="h-8 w-8 rounded-full border-[3px]"
        style={{
          borderColor: '#F4E2B8',
          borderTopColor: '#C68B59',
          animation: 'spin 0.8s linear infinite',
        }}
      />
    </div>
  )
}
