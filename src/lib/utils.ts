import { Gaze } from "gaze";
import { exec, execSync, ChildProcess, spawn } from "child_process";
import chalk from "chalk";

/**
 * Command types
 */
export interface CommandOptions {
  files: string | string[];
  haltOnError?: boolean;
  run?: string;
  waitFirst?: boolean;
  runpNpm?: string;
  runsNpm?: string;
  [ args: string ]: any;
}

/**
 * Current running Child process.
 */
let child_procs: ChildProcess[] = [];

/**
 * Run command on file or folder change.
 * @param {CommandOptions} cmd - The program arguments from commander module.
 * @return {void}
 */
export function watchAndRun( cmd: any ): void {
  if ( !cmd.args || cmd.args.length === 0 ) {
    console.log( chalk.red( "Nothing passed to watch, exiting!\nFor usage, type: gazeall --help." ) );
    process.exit( 0 );
  }

  // Run using Node.js is only a single file passed.
  if ( !cmd.run && !cmd.runsNpm && !cmd.runpNpm ) {
    cmd.run = `node ${ cmd.args }`;
    cmd.args = [ "**/*.js" ];
  }

  // Check if we run first or wait first.
  if ( !cmd.waitFirst ) {
    run( cmd );
  }

  const gaze = new Gaze( cmd.args );

  // Uncomment for debugging
  // gaze.on( "ready", watcher => {
  //   const watched = gaze.watched();
  //   console.log( chalk.magenta( watched ) );
  // } );

  gaze.on( "changed", ( file: string ) => {
    if ( child_procs ) {
      child_procs.forEach( ( proc: ChildProcess ) => {
        proc.kill();
      } );
      child_procs = [];
    }
    run( cmd );
  } );

}

/**
 * Execute Child process based on switch used.
 * @param {CommandOptions} cmd - Commander program arguments.
 * @return {void}
 */
function run( cmd: CommandOptions ): void {
  // Only one of the following with run.
  if ( cmd.run ) {
    console.log( chalk.blue( `=> Running: ${ cmd.run }` ) );
    runCommand( cmd.run, cmd.haltOnError );
  } else if ( cmd.runpNpm ) {
    const run_list: string[] = cmd.runpNpm.split( /\s+/ );
    run_list.forEach( ( command: string ) => {
      runNPMCommand( `npm run ${ command }`, cmd.haltOnError );
    } );
  } else if ( cmd.runsNpm ) {
    const run_list: string[] = cmd.runsNpm.split( /\s+/ );
    run_list.forEach( ( command: string ) => {
      runNPMSyncCommand( `npm run ${ command }`, cmd.haltOnError );
    } );
  }

}

/**
 * Child process run in detached mode in their own terminal.
 * @param {string} command - Command executed in a detached Child process.
 * @param {err_halt} boolean - Determines gazeall respose on an error,
 *                              If false, then ignore the error,
 *                              If true, then exit gazeall.
 * @return {void}
 */
function runCommand( command: string, err_halt: boolean ): void {
  const args: string[] = command.split( /\s+/ );
  const cmd: string = args.shift();
  const proc: ChildProcess = spawn( cmd, args, { detached: true } );
  child_procs.push( proc );

  proc.stdout.on( "data", ( data: Buffer ) => {
    console.log( data.toString() );
  } );

  proc.stderr.on( "data", ( data: Buffer ) => {
    console.log( chalk.red( data.toString() ) );
    if ( err_halt ) {
      console.log( chalk.red( "Error! Forked Child process terminating." ) );
      process.exit( 1 );
    }
  } );

  // Uncomment to debug process termination.
  // child_procs.on( "close", code => {
  //   console.log( chalk.red( "TERMINATED: Child process." ) );
  // } );
}

/**
 * Run NPM scripts asynchronously for switch --runp-npm
 * @param {string} command - Command to execute.
 * @param {boolean} err_halt - Determines gazeall respose on an error,
 *                              If false, then ignore the error,
 *                              If true, then exit gazeall.
 * @return {void}
 */
function runNPMCommand( command: string, err_halt: boolean ): void {
  const proc: ChildProcess =
    exec( command, ( err, stdout, stderr ) => {
      if ( err && err_halt ) {
        throw err;
      }
      if ( stderr ) {
        console.log( chalk.red( stderr ) );
        return;
      }
      if ( stdout ) {
        console.log( stdout );
      }
    } ); // exec
  child_procs.push( proc );
}

/**
 * Run NPM scripts synchronously for switch --runs-npm
 * @param {string} command - Command to execute.
 * @param {boolean} err_halt - Determines gazeall respose on an error,
 *                              If false, then ignore the error,
 *                              If true, then exit gazeall.
 * @return {void}
 */
function runNPMSyncCommand( command: string, err_halt: boolean ): void {
  try {
    const out: Buffer | String = execSync( command );
    if ( out ) {
      console.log( out.toString() );
    }
  } catch ( err ) {
    if ( err_halt ) {
      throw err;
    }
  }
}
