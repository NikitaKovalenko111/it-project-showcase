package app

import (
	"context"
	"fmt"
	"net/http"

	"it-project-showcase/backend/internal/config"
	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/objectstorage"
	"it-project-showcase/backend/internal/services"
	"it-project-showcase/backend/internal/storage"
	transport "it-project-showcase/backend/internal/transport/http"
	"it-project-showcase/backend/internal/transport/http/handlers"
	"it-project-showcase/backend/pkg"
)

func Run(cfg *config.Config) {
	logger := pkg.InitLogger(cfg.LogLevel)

	logger.Debug("Debug is enabled")
	logger.Info("Info is enabled")
	logger.Warn("Warn is enabled")
	logger.Error("Error is enabled")

	connectContext, cancelConnect := context.WithTimeout(context.Background(), cfg.TIMEOUT)
	defer cancelConnect()

	storage, err := storage.Connect(connectContext, cfg.Postgres)
	if err != nil {
		panic(fmt.Errorf("failed connection to storage: %v", err))
	}
	defer storage.Db.Close()

	objects, err := objectstorage.Connect(connectContext, cfg.ObjectStorage)
	if err != nil {
		panic(fmt.Errorf("failed connection to object storage: %v", err))
	}

	services := services.Init(storage, objects, cfg.JWT, cfg.ObjectStorage, cfg.Email)

	cleanupContext, stopSessionCleanup := context.WithCancel(context.Background())
	defer stopSessionCleanup()
	go services.RunSessionCleanup(
		cleanupContext,
		cfg.JWT.SessionCleanupInterval,
		cfg.TIMEOUT,
		logger,
	)
	go services.Platform.RunEmailWorker(cleanupContext)

	handlers := handlers.Init(services)

	mux := http.NewServeMux()
	authorize := middleware.Authorization(cfg.JWT.AccessSecret, logger)
	transport := transport.Init(handlers, authorize)
	transport.Start(mux)

	requestHandler := middleware.RequestID(
		middleware.Logger(logger)(
			middleware.CORS(cfg.CORS_ALLOWED_ORIGINS)(
				middleware.TimeoutExcept(cfg.TIMEOUT, "/api/v1/notifications/stream")(mux),
			),
		),
	)
	server := &http.Server{
		Addr:              cfg.HTTP_ADDRESS,
		Handler:           requestHandler,
		ReadHeaderTimeout: cfg.TIMEOUT,
		ReadTimeout:       cfg.TIMEOUT,
		WriteTimeout:      cfg.TIMEOUT,
		IdleTimeout:       cfg.IDLE_TIMEOUT,
	}

	if err := server.ListenAndServe(); err != nil {
		panic(err)
	}
}
