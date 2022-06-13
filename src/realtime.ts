import * as signalR from "@microsoft/signalr";
import WeavyConsole from "./utils/console";

const HUB_PATH: string = "/hubs/rtm";
const EVENT_NAMESPACE: string = ".connection";

const console = new WeavyConsole("realtime");

/** Represents a connection to a Weavy realtime signalR hub. */
export default class Connection {
  private connection: signalR.HubConnection;
  private url?: string | URL;
  private tokenFactory?(): string | Promise<string>;
  private connectionEvents: { name: string, handler: (...args: any[]) => void }[];

  /** 
   * Constructor for Connection.
   *
   * @param {string | URL} url - The url to the Weavy instance.         
   * @param {string | Promise<string>} tokenFactory - A string, a promise or a function returning a string or promise. The string provides an access token required for HTTP Bearer authentication         
   */
  constructor(url: string | URL, tokenFactory?: string | Promise<string> | (() => string | Promise<string>)) {
    this.url = url;
    this.tokenFactory = tokenFactory instanceof Function ? tokenFactory : () => tokenFactory;
    this.connectionEvents = [];
  }

  /** 
   * Initiate the connection.
   *
   * @returns {Promise<void>} - A Promise that resolves when the connection has been successfully established, or rejects with an error.
   */
  async connect(): Promise<void> {
    console.debug("connect")

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(new URL(HUB_PATH, this.url).toString(), {
        accessTokenFactory: this.tokenFactory
      })
      .withAutomaticReconnect()
      .configureLogging(console.options.info ? signalR.LogLevel.Information : signalR.LogLevel.Warning)
      .build();

    this.connection.onclose((error?: Error) => this.triggerHandler("close", error));
    this.connection.onreconnecting((error?: Error) => this.triggerHandler("reconnecting", error));
    this.connection.onreconnected((connectionId?: string) => this.triggerHandler("reconnected", connectionId));

    await this.connection.start();

  }

  /** 
   * Subscribes the user to the specified group.
   *
   * @param {string} group - The name of the group to subscribe to.         
   */
  async subscribe(group: string) {
    console.debug("subscribe")

    if (!this.connection) {
      throw new Error("You must connect before subscribing!");
    }

    await this.connection.invoke("AddToGroup", group);

  }

  /** 
   * Invoke a method on the server.
   *
   * @param {string} methodName - The name of the mothod to invoke.         
   * @param {any[]} args - Arguments used to invoke the server method.         
   */
  async invoke(methodName: string, ...args: any[]) {
    console.debug("invoke:", methodName)

    if (!this.connection) {
      throw new Error("You must connect before invoking a mothod on the server!");
    }

    await this.connection.invoke(methodName, args);

  }

  /** 
   * Binds an event handler to the specified method name invoked by the server.
   *
   * @param {string} name - The name of the method invoked by the server to bind the event handler to.         
   * @param {Function} handler - The event handler to be raised.         
   */
  on(name: string, handler: (...args: any[]) => void) {
    console.debug("on")

    if (!this.connection) {
      throw new Error("You must connect before binding events!");
    }

    if (name.endsWith(EVENT_NAMESPACE)) {
      this.connectionEvents.push({ name: name, handler: handler });
    } else {
      this.connection.on(name, handler);
    }
  }

  /** 
   * Unbinds an event handler with the specified event name.
   *
   * @param {string} name - The name of the event to unbind the handler from.         
   * @param {Function} handler - The event handler.         
   */
  off(name: string, handler: (...args: any[]) => void) {
    console.debug("off")

    if (!this.connection) {
      throw new Error("You must connect before un-binding events!");
    }

    if (name.endsWith(EVENT_NAMESPACE)) {
      this.connectionEvents = this.connectionEvents.filter((eventHandler) => !(eventHandler.name === name && eventHandler.handler === handler))
    } else {
      this.connection.off(name, handler);
    }
  }

  /**
   * Trigger connection event.
   * 
   * @param name - The name of the event. Connection event namespace will be automatically added.
   * @param [...data] - Optional data passed to the event handlers.
   */
  triggerHandler(name: string, ...data: any) {
    name = name.endsWith(EVENT_NAMESPACE) ? name : name + EVENT_NAMESPACE;
    let event = new CustomEvent(name, { cancelable: false });

    console.debug("triggerHandler", name);

    this.connectionEvents.forEach((eventHandler) => {
      if (eventHandler.name === name) {
        eventHandler.handler(event, ...data);
      }
    });
  }

  /** 
   * Disconnect the realtime connection. 
   *
   * @returns {Promise<void>} - A Promise that resolves when the connection has been successfully disconnected, or rejects with an error.   
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
    }
  }


  /**
   * Disconnects any active connection and then connects again.
   * Typically used when changing user while using cookie authentication.
   * 
   * @returns {Promise<void>}
   */
  async disconnectAndConnect(): Promise<void> {
    if (this.connection && this.connection.state !== signalR.HubConnectionState.Disconnected) {
      await this.connection.stop();
      await this.connection.start();
    } else {
      throw new Error("No active connection to disconnect and connect.");
    }
  }
}
