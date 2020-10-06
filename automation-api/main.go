package main

import (
	"context"
	"fmt"
	"path/filepath"
)

// Playing with the automation API
func main() {
	ctx := context.Background()

	// create a workspace from a local project
	w, _ := NewLocalWorkspace(ctx, WorkDir(filepath.Join(".", "program")))
	// initialize the stack
	err := w.CreateStack(ctx, "MitchGerdisch/autoproj/autostack")
	if err != nil {
		fmt.Println("Failed to create stack")
	}

}
