#!/usr/bin/env node

/**
 * Playwright EasyScale Orchestrator
 * Main CLI entry point for distributed test execution
 */

const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const { loadConfig } = require('./config');
const { calculateDistribution, generateContainerEnv, displayDistributionPlan } = require('./distributor');
const RailwayClient = require('./railway');
const Logger = require('./logger');
const crypto = require('crypto');

program
  .name('playwright-easyscale')
  .description('Orchestrate distributed Playwright tests across Railway containers')
  .version('1.0.0');

program
  .option('-c, --config <path>', 'Path to test configuration file')
  .option('-d, --dry-run', 'Show execution plan without deploying')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('\n🚀 Playwright EasyScale Orchestrator\n'));

      if (!options.config) {
        console.error(chalk.red('Error: --config option is required'));
        console.log(chalk.yellow('\nUsage: node src/index.js --config=../configs/example.json\n'));
        process.exit(1);
      }

      // Generate unique run ID
      const runId = `run-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      
      // Initialize logger
      const logger = new Logger(runId);
      logger.info('Starting orchestrator', { runId, config: options.config });

      // Load and validate configuration
      const spinner = ora('Loading configuration...').start();
      let config;
      try {
        config = loadConfig(options.config);
        spinner.succeed('Configuration loaded and validated');
        logger.info('Configuration loaded', { name: config.name });
      } catch (error) {
        spinner.fail('Configuration failed');
        throw error;
      }

      // Calculate distribution
      const distribution = calculateDistribution(config.totalUsers, config.usersPerContainer);
      displayDistributionPlan(distribution, config);
      logger.info('Distribution calculated', { 
        totalContainers: distribution.totalContainers,
        totalUsers: distribution.totalUsers 
      });

      // Dry run mode - exit here
      if (options.dryRun) {
        console.log(chalk.yellow('\n✓ Dry run complete - no containers deployed\n'));
        logger.info('Dry run completed');
        return;
      }

      // Confirm deployment
      console.log(chalk.yellow('⚠️  This will deploy containers to Railway and incur costs.'));
      console.log(chalk.gray(`   Estimated cost: ~$${(distribution.totalContainers * 0.02).toFixed(2)} for 30 minutes\n`));
      
      // In a real scenario, you'd want to add a confirmation prompt here
      // For now, we'll proceed automatically

      // Initialize Railway client
      const railway = new RailwayClient(config.railway.apiToken);
      logger.info('Railway client initialized');

      // Deploy containers
      console.log(chalk.blue('\n📦 Deploying containers...\n'));
      const deployments = [];

      for (const container of distribution.containers) {
        const containerSpinner = ora(`Deploying container ${container.index}/${distribution.totalContainers}...`).start();
        
        try {
          // Generate environment variables for this container
          const env = generateContainerEnv(container, config, runId);
          
          // Deploy to Railway
          const deployment = await railway.deployService(
            config.railway.projectId,
            config.railway.serviceId,
            env
          );

          deployments.push({
            container,
            deployment,
            env
          });

          containerSpinner.succeed(`Container ${container.index} deployed (users ${container.startUser}-${container.endUser})`);
          logger.info('Container deployed', { 
            containerIndex: container.index,
            deploymentId: deployment.deploymentId 
          });

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          containerSpinner.fail(`Container ${container.index} failed`);
          logger.error('Container deployment failed', { 
            containerIndex: container.index,
            error: error.message 
          });
          throw error;
        }
      }

      console.log(chalk.green(`\n✓ All ${deployments.length} containers deployed successfully!\n`));
      logger.info('All containers deployed', { count: deployments.length });

      // Monitor deployments
      console.log(chalk.blue('👀 Monitoring deployments...\n'));
      console.log(chalk.gray('   Run ID: ' + runId));
      console.log(chalk.gray('   Log file: ' + logger.getLogFile()));
      console.log(chalk.gray('\n   Containers will run tests and upload results to storage.'));
      console.log(chalk.gray('   Check your storage bucket for results.\n'));

      // Note: In a full implementation, we would:
      // 1. Monitor deployment status
      // 2. Wait for all containers to complete
      // 3. Aggregate logs from storage
      // 4. Generate summary report
      // 5. Clean up deployments

      console.log(chalk.yellow('⚠️  Note: Automatic monitoring and cleanup not yet implemented.'));
      console.log(chalk.gray('   You may need to manually stop containers in Railway dashboard.\n'));

      logger.info('Orchestration complete');

    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
