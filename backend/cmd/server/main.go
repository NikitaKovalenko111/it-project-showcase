package main

import (
	"flag"
	"fmt"
	"it-project-showcase/backend/internal/app"
	"it-project-showcase/backend/internal/config"
)

func main() {
	configPath := flag.String(
		"config",
		"./config/config.yaml",
		"path to config file",
	)

	flag.Parse()

	config, err := config.Load(*configPath)
	if err != nil {
		panic(fmt.Errorf("failed to load config: %v", err))
	}

	app.Run(config)
}
