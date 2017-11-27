
import { Component, CssClassMap, Element, Event, EventEmitter, Listen, Method, Prop } from '@stencil/core';
import { Animation, AnimationBuilder, AnimationController, Config } from '../../index';
import { playAnimationAsync } from '../../utils/helpers';

import { createThemedClasses } from '../../utils/theme';

import iOSEnterAnimation from './animations/ios.enter';
import iOSLeaveAnimation from './animations/ios.leave';

import MdEnterAnimation from './animations/md.enter';
import MdLeaveAnimation from './animations/md.leave';

@Component({
  tag: 'ion-alert',
  styleUrls: {
    ios: 'alert.ios.scss',
    md: 'alert.md.scss'
  },
  host: {
    theme: 'alert'
  }
})
export class Alert {
  mode: string;
  color: string;

  private animation: Animation;
  private activeId: string;
  private inputType: string;
  private hdrId: string;

  @Element() private el: HTMLElement;

  /**
   * @output {AlertEvent} Emitted after the alert has loaded.
   */
  @Event() ionAlertDidLoad: EventEmitter;

  /**
   * @output {AlertEvent} Emitted after the alert has presented.
   */
  @Event() ionAlertDidPresent: EventEmitter;

  /**
   * @output {AlertEvent} Emitted before the alert has presented.
   */
  @Event() ionAlertWillPresent: EventEmitter;

  /**
   * @output {AlertEvent} Emitted before the alert has dismissed.
   */
  @Event() ionAlertWillDismiss: EventEmitter;

  /**
   * @output {AlertEvent} Emitted after the alert has dismissed.
   */
  @Event() ionAlertDidDismiss: EventEmitter;

  /**
   * @output {AlertEvent} Emitted after the alert has unloaded.
   */
  @Event() ionAlertDidUnload: EventEmitter;

  @Prop({ connect: 'ion-animation-controller' }) animationCtrl: AnimationController;
  @Prop({ context: 'config' }) config: Config;

  @Prop() cssClass: string;
  @Prop() title: string;
  @Prop() subTitle: string;
  @Prop() message: string;
  @Prop() buttons: AlertButton[] = [];
  @Prop({ mutable: true }) inputs: AlertInput[] = [];
  @Prop() enableBackdropDismiss: boolean = true;
  @Prop() translucent: boolean = false;

  @Prop() alertId: string;

  @Prop() enterAnimation: AnimationBuilder;
  @Prop() leaveAnimation: AnimationBuilder;

  @Method() present() {
    if (this.animation) {
      this.animation.destroy();
      this.animation = null;
    }
    this.ionAlertWillPresent.emit();

    // get the user's animation fn if one was provided
    const animationBuilder = this.enterAnimation || this.config.get('alertEnter', this.mode === 'ios' ? iOSEnterAnimation : MdEnterAnimation);

    // build the animation and kick it off
    return this.animationCtrl.create(animationBuilder, this.el).then(animation => {
      this.animation = animation;
      return playAnimationAsync(animation);
    }).then((animation) => {
      animation.destroy();
      const firstInput = this.el.querySelector('[tabindex]') as HTMLElement;
      if (firstInput) {
        firstInput.focus();
      }

      this.ionAlertDidPresent.emit();
    });
  }

  @Method() dismiss() {
    if (this.animation) {
      this.animation.destroy();
      this.animation = null;
    }
    this.ionAlertWillDismiss.emit();

    // get the user's animation fn if one was provided
    const animationBuilder = this.leaveAnimation || this.config.get('alertLeave', this.mode === 'ios' ? iOSLeaveAnimation : MdLeaveAnimation);

    return this.animationCtrl.create(animationBuilder, this.el).then(animation => {
      this.animation = animation;
      return playAnimationAsync(animation);
    }).then((animation) => {
      animation.destroy();
      this.ionAlertDidDismiss.emit();

      Context.dom.write(() => {
        this.el.parentNode.removeChild(this.el);
      });
    });
  }

  componentDidLoad() {
    this.ionAlertDidLoad.emit({ alert: this });
  }

  componentDidEnter() {
    this.ionAlertDidPresent.emit({ alert: this });
  }

  componentDidUnload() {
    this.ionAlertDidUnload.emit({ alert: this });
  }

  @Listen('ionDismiss')
  protected onDismiss(ev: UIEvent) {
    ev.stopPropagation();
    ev.preventDefault();

    this.dismiss();
  }

  protected backdropClick() {
    if (this.enableBackdropDismiss) {
      // const opts: NavOptions = {
      //   minClickBlockDuration: 400
      // };
      this.dismiss();
    }
  }

  rbClick(inputIndex: number) {
    this.inputs = this.inputs.map((input, index) => {
      input.checked = (inputIndex === index);
      return input;
    });

    const rbButton = this.inputs[inputIndex];
    this.activeId = rbButton.id;

    if (rbButton.handler) {
      rbButton.handler(rbButton);
    }
  }

  cbClick(inputIndex: number) {
    this.inputs = this.inputs.map((input, index) => {
      if (inputIndex === index) {
        input.checked = !input.checked;
      }
      return input;
    });

    const cbButton = this.inputs[inputIndex];
    if (cbButton.handler) {
      cbButton.handler(cbButton);
    }
  }

  buttonClick(button: any) {
    console.log('buttonClick', button);

    // TODO keep the time of the most recent button click
    // this.lastClick = Date.now();

    let shouldDismiss = true;

    if (button.handler) {
      // a handler has been provided, execute it
      // pass the handler the values from the inputs
      if (button.handler(this.getValues()) === false) {
        // if the return value of the handler is false then do not dismiss
        shouldDismiss = false;
      }
    }

    if (shouldDismiss) {
      this.dismiss();
    }
  }

  getValues(): any {
    if (this.inputType === 'radio') {
      // this is an alert with radio buttons (single value select)
      // return the one value which is checked, otherwise undefined
      const checkedInput = this.inputs.find(i => i.checked);
      console.debug('returning', checkedInput ? checkedInput.value : undefined);
      return checkedInput ? checkedInput.value : undefined;
    }

    if (this.inputType === 'checkbox') {
      // this is an alert with checkboxes (multiple value select)
      // return an array of all the checked values
      console.debug('returning', this.inputs.filter(i => i.checked).map(i => i.value));
      return this.inputs.filter(i => i.checked).map(i => i.value);
    }

    if (this.inputs.length === 0) {
      // this is an alert without any options/inputs at all
      console.debug('returning', 'undefined');
      return undefined;
    }

    // this is an alert with text inputs
    // return an object of all the values with the input name as the key
    const values: {[k: string]: string} = {};
    this.inputs.forEach(i => {
      values[i.name] = i.value;
    });

    console.debug('returning', values);
    return values;
  }

  buttonClass(button: AlertButton): CssClassMap {
    let buttonClass: string[] = !button.cssClass
      ? ['alert-button']
      : [`alert-button`, `${button.cssClass}`];

    return buttonClass.reduce((prevValue: any, cssClass: any) => {
      prevValue[cssClass] = true;
      return prevValue;
    }, {});
  }

  renderCheckbox(inputs: AlertInput[]) {
    if (inputs.length === 0) return null;

    return (
      <div class='alert-checkbox-group'>
        { inputs.map((i, index) => (
          <button onClick={() => this.cbClick(index)} aria-checked={i.checked} id={i.id} disabled={i.disabled} tabIndex={0} role='checkbox' class='alert-tappable alert-checkbox alert-checkbox-button'>
            <div class='button-inner'>
              <div class='alert-checkbox-icon'><div class='alert-checkbox-inner'></div></div>
              <div class='alert-checkbox-label'>
                {i.label}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  renderRadio(inputs: AlertInput[]) {
    if (inputs.length === 0) return null;

    return (
      <div class='alert-radio-group' role='radiogroup' aria-labelledby={this.hdrId} aria-activedescendant={this.activeId}>
        { inputs.map((i, index) => (
          <button onClick={() => this.rbClick(index)} aria-checked={i.checked} disabled={i.disabled} id={i.id} tabIndex={0} class='alert-radio-button alert-tappable alert-radio' role='radio'>
            <div class='button-inner'>
              <div class='alert-radio-icon'><div class='alert-radio-inner'></div></div>
              <div class='alert-radio-label'>
                {i.label}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  renderInput(inputs: AlertInput[]) {
    if (inputs.length === 0) return null;

    return (
      <div class='alert-input-group'>
        { inputs.map(i => (
          <div class='alert-input-wrapper'>
            <input
              placeholder={i.placeholder}
              value={i.value}
              type={i.type}
              min={i.min}
              max={i.max}
              id={i.id}
              tabIndex={0}
              class='alert-input'/>
          </div>
        ))}
      </div>
    );
  }

  hostData() {
    const themedClasses = this.translucent ? createThemedClasses(this.mode, this.color, 'alert-translucent') : {};

    const hostClasses = {
      ...themedClasses
    };

    return {
      class: hostClasses,
      id: this.alertId
    };
  }

  render() {
    const hdrId = `${this.alertId}-hdr`;
    const subHdrId = `${this.alertId}-sub-hdr`;
    const msgId = `${this.alertId}-msg`;

    if (this.title || !this.subTitle) {
      this.hdrId = hdrId;

    } else if (this.subTitle) {
      this.hdrId = subHdrId;
    }

    const alertButtonGroupClass = {
      'alert-button-group': true,
      'alert-button-group-vertical': this.buttons.length > 2
    };

    const buttons = this.buttons
      .map(b => {
        if (typeof b === 'string') {
          b = { text: b };
        }
        return b;
      })
      .filter(b => b !== null);

    // An alert can be created with several different inputs. Radios,
    // checkboxes and inputs are all accepted, but they cannot be mixed.
    const inputTypes: string[] = [];

    this.inputs = this.inputs
      .map((i, index) => {
        let r: AlertInput = {
          type: i.type || 'text',
          name: i.name ? i.name : index + '',
          placeholder: i.placeholder ? i.placeholder : '',
          value: i.value ? i.value : '',
          label: i.label,
          checked: !!i.checked,
          disabled: !!i.disabled,
          id: i.id ? i.id : `alert-input-${this.alertId}-${index}`,
          handler: i.handler ? i.handler : null,
          min: i.min ? i.min : null,
          max: i.max ? i.max : null
        };
        return r;
      })
      .filter(i => i !== null);

      this.inputs.forEach(i => {
      if (inputTypes.indexOf(i.type) < 0) {
        inputTypes.push(i.type);
      }
    });

    if (inputTypes.length > 1 && (inputTypes.indexOf('checkbox') > -1 || inputTypes.indexOf('radio') > -1)) {
      console.warn(`Alert cannot mix input types: ${(inputTypes.join('/'))}. Please see alert docs for more info.`);
    }

    this.inputType = inputTypes.length ? inputTypes[0] : null;

    return [
      <ion-backdrop
        onClick={this.backdropClick.bind(this)}
        class='alert-backdrop'
      />,
      <div class='alert-wrapper'>
        <div class='alert-head'>
          {this.title
              ? <h2 id={hdrId} class='alert-title'>{this.title}</h2>
              : null}
          {this.subTitle
              ? <h2 id={subHdrId} class='alert-sub-title'>{this.subTitle}</h2>
              : null}
        </div>
        <div id={msgId} class='alert-message' innerHTML={this.message}></div>

        {(() => {
          switch (this.inputType) {
            case 'checkbox':
              return this.renderCheckbox(this.inputs);

            case 'radio':
              return this.renderRadio(this.inputs);

            default:
              return this.renderInput(this.inputs);
          }
        })()}

        <div class={alertButtonGroupClass}>
          {buttons.map(b =>
            <button class={this.buttonClass(b)} tabIndex={0} onClick={() => this.buttonClick(b)}>
              <span class='button-inner'>
                {b.text}
              </span>
            </button>
          )}
       </div>
      </div>
    ];
  }

}


export interface AlertOptions {
  title?: string;
  subTitle?: string;
  message?: string;
  cssClass?: string;
  mode?: string;
  inputs?: AlertInput[];
  buttons?: (AlertButton|string)[];
  enableBackdropDismiss?: boolean;
  translucent?: boolean;
}

export interface AlertInput {
  type?: string;
  name?: string | number;
  placeholder?: string;
  value?: string;
  label?: string;
  checked?: boolean;
  disabled?: boolean;
  id?: string;
  handler?: Function;
  min?: string | number;
  max?: string | number;
}

export interface AlertButton {
  text?: string;
  role?: string;
  cssClass?: string;
  handler?: (value: any) => boolean|void;
}

export interface AlertEvent extends Event {
}

export { iOSEnterAnimation, iOSLeaveAnimation, MdEnterAnimation, MdLeaveAnimation };
