import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowDown, ArrowRight, Check, Clock3, Leaf, MoveUpRight, Sparkles } from 'lucide-react';
import { LandingTree } from './landing-tree';
import { LandingMotion } from './landing-motion';
import styles from '../../app/landing/page.module.css';

export const metadata: Metadata = {
  title: 'Chrono — Make time for growth',
  description:
    'Turn overwhelming to-do lists into a clearer day. Plan with AI, find your focus, and grow a personal forest with Chrono.',
};

export function LandingPage() {
  return (
    <div className={styles.page} data-theme="dark">
      <LandingMotion />
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Chrono home">
          <img src="/chrono-logo.png" alt="" width={38} height={38} />
          <span>Chrono</span>
        </Link>
        <nav className={styles.navigation} aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#your-forest">Your forest</a>
        </nav>
        <Link href="/login" className={styles.signIn}>
          Sign in <MoveUpRight size={15} />
        </Link>
      </header>

      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.mountains} aria-hidden="true" />
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              <span /> A little focus. A little growth.
            </p>
            <h1 id="hero-title">
              Make time
              <br />
              for <span>growth.</span>
            </h1>
            <p className={styles.intro}>
              A clearer plan. A calmer mind. Turn your everyday tasks into meaningful progress with
              your AI scheduling companion.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/register">
                Start your journey <ArrowRight size={18} />
              </Link>
              <a className={styles.textLink} href="#how-it-works">
                Explore Chrono <ArrowDown size={16} />
              </a>
            </div>
            <p className={styles.quietNote}>Your pace. Your priorities. Your personal forest.</p>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.orbit} aria-hidden="true" />
            <div className={styles.treeLabel}>
              <span /> A little more grown, every day
            </div>
            <LandingTree />
            <div className={styles.growthNote}>
              <Leaf size={17} />
              <span>
                Small steps.
                <br />
                <strong>Something beautiful.</strong>
              </span>
            </div>
          </div>
          <div className={styles.heroFoot}>
            <span>LESS OVERWHELM. MORE POSSIBILITY.</span>
            <a href="#how-it-works" aria-label="Discover how Chrono works">
              <ArrowDown size={19} />
            </a>
            <span>MADE FOR YOUR EVERYDAY</span>
          </div>
        </section>

        <section className={styles.productSection} aria-labelledby="product-title">
          <div className={styles.productHeading} data-reveal>
            <p className={styles.eyebrow}>A little space for everything</p>
            <h2 id="product-title">Your day, beautifully in view.</h2>
            <p>
              Tasks, priorities, and a clearer next step. One calm workspace to bring it all
              together.
            </p>
          </div>
          <figure className={styles.laptop} data-reveal data-reveal-delay="1">
            <div className={styles.deviceStage}>
              <div className={styles.desktopMockup}>
                <img
                  className={styles.deviceFrame}
                  src="/images/landing/mockup-macbook.png"
                  alt=""
                  width={1008}
                  height={635}
                  loading="lazy"
                />
                <div className={styles.desktopScreen}>
                  <img
                    src="/images/landing/mockup-dashboard-desktop.png"
                    alt="Chrono dashboard on a desktop, with progress cards, AI task recommendations, and task lists"
                    width={1372}
                    height={846}
                    loading="lazy"
                  />
                </div>
              </div>
              <div className={styles.mobileMockup}>
                <img
                  className={styles.deviceFrame}
                  src="/images/landing/mockup-mobile-frame.png"
                  alt=""
                  width={438}
                  height={798}
                  loading="lazy"
                />
                <div className={styles.mobileScreen}>
                  <img
                    className={styles.mobileDashboardCapture}
                    src="/images/landing/mockup-dashboard-mobile.png"
                    alt="Chrono mobile dashboard with progress cards, an AI task recommendation, and bottom navigation"
                    width={397}
                    height={798}
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
            <figcaption>One clear view, wherever you plan.</figcaption>
          </figure>
        </section>

        <section id="how-it-works" className={styles.howSection} aria-labelledby="how-title">
          <div className={styles.sectionHeading} data-reveal>
            <div>
              <p className={styles.eyebrow}>Find your rhythm</p>
              <h2 id="how-title">
                A good day starts
                <br />
                with a little clarity.
              </h2>
            </div>
            <p>
              From the first idea to the final checkmark, Chrono helps you make space for what
              matters.
            </p>
          </div>
          <div className={styles.featureGrid}>
            <article className={styles.feature} data-reveal data-reveal-delay="0">
              <div className={styles.featureTop}>
                <Sparkles size={22} />
                <span>01 / PLAN</span>
              </div>
              <h3>Big ideas. Small steps.</h3>
              <p>
                Describe what you want to do. AI helps turn it into manageable tasks you can review
                and make your own.
              </p>
              <div className={styles.taskPreview} aria-label="Example task plan">
                <span>
                  <Check size={14} /> Gather your ideas
                </span>
                <span>
                  <span className={styles.emptyCheck} /> Create a first draft <small>Next up</small>
                </span>
                <span>
                  <span className={styles.emptyCheck} /> Make it yours
                </span>
              </div>
            </article>
            <article className={styles.feature} data-reveal data-reveal-delay="1">
              <div className={styles.featureTop}>
                <Clock3 size={22} />
                <span>02 / FOCUS</span>
              </div>
              <h3>One thing at a time.</h3>
              <p>
                Give your next task your full attention. Focus sessions help you create a rhythm,
                with room to take a breath.
              </p>
              <div className={styles.focusPreview}>
                <div>
                  <span>25:00</span>
                  <small>A moment to focus</small>
                </div>
              </div>
            </article>
            <article className={styles.feature} data-reveal data-reveal-delay="2">
              <div className={styles.featureTop}>
                <Leaf size={22} />
                <span>03 / GROW</span>
              </div>
              <h3>See your effort bloom.</h3>
              <p>
                Completed tasks and focus sessions earn growth points. Put them towards a forest
                that grows alongside you.
              </p>
              <div
                className={styles.seedlings}
                aria-label="A tree growing from seedling to maturity"
              >
                <img
                  src="/images/plants/oak/seedling.png"
                  alt="Seedling"
                  width={90}
                  height={90}
                  loading="lazy"
                />
                <img
                  src="/images/plants/oak/growing.png"
                  alt="Growing oak"
                  width={112}
                  height={112}
                  loading="lazy"
                />
                <img
                  src="/images/plants/oak/mature.png"
                  alt="Mature oak"
                  width={132}
                  height={132}
                  loading="lazy"
                />
              </div>
            </article>
          </div>
        </section>

        <section id="your-forest" className={styles.forestSection} aria-labelledby="forest-title">
          <div className={styles.forestArt} data-reveal>
            <span className={styles.forestRing} aria-hidden="true" />
            <img
              src="/images/plants/pine/mature.png"
              alt=""
              width={220}
              height={220}
              loading="lazy"
            />
            <img
              src="/images/plants/oak/mature.png"
              alt="A personal forest of oak, pine, and blossom trees"
              width={330}
              height={330}
              loading="lazy"
            />
            <img
              src="/images/plants/cherry_blossom/mature.png"
              alt=""
              width={220}
              height={220}
              loading="lazy"
            />
            <span className={styles.forestCaption}>
              <Leaf size={14} /> Rooted in your everyday effort
            </span>
          </div>
          <div className={styles.forestCopy} data-reveal data-reveal-delay="1">
            <p className={styles.eyebrow}>Your progress, brought to life</p>
            <h2 id="forest-title">
              More than a<br />
              finished to-do list.
            </h2>
            <p>
              Some days you take a leap. Other days, a small step is enough. Your personal forest is
              a reminder that every effort adds up.
            </p>
            <Link href="/register" className={styles.textLink}>
              Plant your first seed <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <section className={styles.closing} aria-labelledby="start-title" data-reveal>
          <p className={styles.eyebrow}>One small step starts it all</p>
          <h2 id="start-title">
            Your next chapter
            <br />
            starts with today.
          </h2>
          <Link href="/register" className={styles.primaryButton}>
            Find your focus <ArrowRight size={18} />
          </Link>
        </section>
      </main>
      <footer className={styles.footer}>
        <Link href="/" className={styles.brand}>
          <img src="/chrono-logo.png" alt="" width={30} height={30} />
          <span>Chrono</span>
        </Link>
        <p>A little more focused. A little more you.</p>
        <Link href="/login">
          Sign in <ArrowRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
