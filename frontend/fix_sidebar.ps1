$files = @('agenda.html', 'finance.html', 'goals.html', 'history.html', 'schedule.html')
foreach ($f in $files) {
    $path = "frontend/$f"
    if (Test-Path $path) {
        $content = Get-Content $path -Raw
        
        # Replace Sidebar container
        $content = $content -replace 'bg-gray-900 text-white', 'bg-[var(--matcha-sidebar-bg)] text-[var(--matcha-sidebar-text)]'
        $content = $content -replace 'border-gray-800', 'border-[var(--matcha-sidebar-border)]'
        
        # Replace Sidebar hover states
        $content = $content -replace 'hover:bg-gray-700', 'hover:bg-[var(--matcha-main-glow)]'
        
        Set-Content $path $content -NoNewline
        Write-Host "Updated sidebar in $f"
    } else {
        Write-Host "File not found: $path"
    }
}
